use crate::downloader::{
    DownloadError, DownloadItemRequest, DownloadProgressEvent, Downloader,
};
use crate::throttle::BandwidthLimiter;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use udeler_core::api::UdemyClient;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum QueueStatus {
    Pending,
    Downloading,
    Completed,
    Failed(String),
    Canceled,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItemSnapshot {
    pub lecture_id: u64,
    pub course_title: String,
    pub lecture_title: String,
    pub status: QueueStatus,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub speed_bps: f64,
    pub eta_secs: Option<u64>,
    pub file_path: Option<PathBuf>,
}

pub struct QueueItem {
    pub request: DownloadItemRequest,
    pub status: QueueStatus,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub speed_bps: f64,
    pub eta_secs: Option<u64>,
    pub file_path: Option<PathBuf>,
    pub cancel_flag: Arc<AtomicBool>,
}

pub struct QueueState {
    pub items: Vec<QueueItem>,
    pub is_paused: bool,
    pub active_count: usize,
    pub max_concurrency: usize,
}

#[derive(Clone)]
pub struct DownloadQueueManager {
    state: Arc<Mutex<QueueState>>,
    #[allow(dead_code)]
    downloader: Arc<Downloader>,
    #[allow(dead_code)]
    event_tx: mpsc::UnboundedSender<DownloadProgressEvent>,
    notify_tx: mpsc::Sender<()>,
}

impl DownloadQueueManager {
    pub fn new(
        client: Arc<UdemyClient>,
        limiter: BandwidthLimiter,
        max_concurrency: usize,
    ) -> (Self, mpsc::UnboundedReceiver<DownloadProgressEvent>) {
        let (event_tx, event_rx) = mpsc::unbounded_channel();
        let (notify_tx, mut notify_rx) = mpsc::channel(100);
        let downloader = Arc::new(Downloader::new(client, limiter));

        let state = Arc::new(Mutex::new(QueueState {
            items: Vec::new(),
            is_paused: false,
            active_count: 0,
            max_concurrency: max_concurrency.max(1),
        }));

        let manager = Self {
            state: state.clone(),
            downloader: downloader.clone(),
            event_tx: event_tx.clone(),
            notify_tx: notify_tx.clone(),
        };

        // Spawn background task scheduler loop
        let state_sched = state.clone();
        let downloader_sched = downloader.clone();
        let event_tx_sched = event_tx.clone();
        let notify_tx_sched = notify_tx.clone();

        tokio::spawn(async move {
            while notify_rx.recv().await.is_some() {
                let mut to_spawn = Vec::new();
                {
                    let mut s = state_sched.lock().await;
                    if s.is_paused {
                        continue;
                    }
                    while s.active_count < s.max_concurrency {
                        let maybe_item = s
                            .items
                            .iter_mut()
                            .find(|i| i.status == QueueStatus::Pending)
                            .map(|item| {
                                item.status = QueueStatus::Downloading;
                                (item.request.clone(), item.cancel_flag.clone())
                            });

                        match maybe_item {
                            Some(spawn_info) => {
                                s.active_count += 1;
                                to_spawn.push(spawn_info);
                            }
                            None => break,
                        }
                    }
                }

                for (req, cancel_flag) in to_spawn {
                    let dl = downloader_sched.clone();
                    let st = state_sched.clone();
                    let ev_tx = event_tx_sched.clone();
                    let ntf_tx = notify_tx_sched.clone();

                    tokio::spawn(async move {
                        let lecture_id = req.lecture_id;
                        let (local_tx, mut local_rx) = mpsc::unbounded_channel();

                        let st_fwd = st.clone();
                        let ev_fwd = ev_tx.clone();
                        let fwd_handle = tokio::spawn(async move {
                            while let Some(evt) = local_rx.recv().await {
                                {
                                    let mut s = st_fwd.lock().await;
                                    if let Some(it) = s.items.iter_mut().find(|i| i.request.lecture_id == lecture_id) {
                                        match &evt {
                                            DownloadProgressEvent::Started { total_bytes, .. } => {
                                                it.total_bytes = *total_bytes;
                                            }
                                            DownloadProgressEvent::Progress {
                                                downloaded_bytes,
                                                total_bytes,
                                                speed_bps,
                                                eta_secs,
                                                ..
                                            } => {
                                                it.downloaded_bytes = *downloaded_bytes;
                                                it.total_bytes = *total_bytes;
                                                it.speed_bps = *speed_bps;
                                                it.eta_secs = *eta_secs;
                                            }
                                            DownloadProgressEvent::Completed { file_path, .. } => {
                                                it.status = QueueStatus::Completed;
                                                it.file_path = Some(file_path.clone());
                                            }
                                            DownloadProgressEvent::Failed { error, .. } => {
                                                it.status = QueueStatus::Failed(error.clone());
                                            }
                                            DownloadProgressEvent::Canceled { .. } => {
                                                it.status = QueueStatus::Canceled;
                                            }
                                        }
                                    }
                                }
                                let _ = ev_fwd.send(evt);
                            }
                        });

                        let result = dl.download_item(req, Some(local_tx), cancel_flag).await;

                        {
                            let mut s = st.lock().await;
                            s.active_count = s.active_count.saturating_sub(1);
                            if let Some(it) = s.items.iter_mut().find(|i| i.request.lecture_id == lecture_id) {
                                match result {
                                    Ok(path) => {
                                        it.status = QueueStatus::Completed;
                                        it.file_path = Some(path);
                                    }
                                    Err(DownloadError::Canceled) => {
                                        it.status = QueueStatus::Canceled;
                                    }
                                    Err(e) => {
                                        it.status = QueueStatus::Failed(e.to_string());
                                    }
                                }
                            }
                        }

                        let _ = fwd_handle.await;
                        let _ = ntf_tx.send(()).await;
                    });
                }
            }
        });

        (manager, event_rx)
    }

    pub async fn set_concurrency(&self, max: usize) {
        let mut state = self.state.lock().await;
        state.max_concurrency = max.max(1);
        let _ = self.notify_tx.send(()).await;
    }

    pub async fn add_items(&self, requests: Vec<DownloadItemRequest>) {
        {
            let mut state = self.state.lock().await;
            for req in requests {
                if state.items.iter().any(|i| {
                    i.request.lecture_id == req.lecture_id
                        && i.status != QueueStatus::Failed("".into())
                        && i.status != QueueStatus::Canceled
                }) {
                    continue;
                }

                state.items.push(QueueItem {
                    request: req,
                    status: QueueStatus::Pending,
                    downloaded_bytes: 0,
                    total_bytes: None,
                    speed_bps: 0.0,
                    eta_secs: None,
                    file_path: None,
                    cancel_flag: Arc::new(AtomicBool::new(false)),
                });
            }
        }
        let _ = self.notify_tx.send(()).await;
    }

    pub async fn cancel_item(&self, lecture_id: u64) {
        let mut state = self.state.lock().await;
        if let Some(item) = state.items.iter_mut().find(|i| i.request.lecture_id == lecture_id) {
            item.cancel_flag.store(true, Ordering::Relaxed);
            item.status = QueueStatus::Canceled;
        }
    }

    pub async fn pause_all(&self) {
        let mut state = self.state.lock().await;
        state.is_paused = true;
        for item in &mut state.items {
            if item.status == QueueStatus::Downloading {
                item.cancel_flag.store(true, Ordering::Relaxed);
                item.status = QueueStatus::Paused;
            }
        }
    }

    pub async fn resume_all(&self) {
        {
            let mut state = self.state.lock().await;
            state.is_paused = false;
            for item in &mut state.items {
                if item.status == QueueStatus::Paused {
                    item.status = QueueStatus::Pending;
                    item.cancel_flag = Arc::new(AtomicBool::new(false));
                }
            }
        }
        let _ = self.notify_tx.send(()).await;
    }

    pub async fn get_snapshots(&self) -> Vec<QueueItemSnapshot> {
        let state = self.state.lock().await;
        state
            .items
            .iter()
            .map(|i| QueueItemSnapshot {
                lecture_id: i.request.lecture_id,
                course_title: i.request.course_title.clone(),
                lecture_title: i.request.lecture_title.clone(),
                status: i.status.clone(),
                downloaded_bytes: i.downloaded_bytes,
                total_bytes: i.total_bytes,
                speed_bps: i.speed_bps,
                eta_secs: i.eta_secs,
                file_path: i.file_path.clone(),
            })
            .collect()
    }
}
