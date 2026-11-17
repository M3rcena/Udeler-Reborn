use crate::throttle::BandwidthLimiter;
use futures_util::StreamExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use thiserror::Error;
use tokio::fs::{self, OpenOptions};
use tokio::io::AsyncWriteExt;
use tokio::sync::mpsc::UnboundedSender;

use udeler_core::api::UdemyClient;
use udeler_core::models::{DownloadUrl, LectureDetailResponse};

#[derive(Error, Debug)]
pub enum DownloadError {
    #[error("API error: {0}")]
    Api(#[from] udeler_core::api::ApiError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Download canceled by user")]
    Canceled,
    #[error("Asset not found or DRM protected")]
    AssetUnavailable(String),
}

#[derive(Debug, Clone)]
pub struct DownloadItemRequest {
    pub course_id: u64,
    pub course_title: String,
    pub chapter_title: String,
    pub lecture_id: u64,
    pub lecture_title: String,
    pub lecture_index: u32,
    pub time_estimation: Option<u64>,
    /// Curriculum item classification (e.g., "Video", "Article", "Quiz", "Practice")
    pub item_type: String,
    pub download_path: PathBuf,
    pub video_quality: String,
    pub skip_subtitles: bool,
    pub skip_attachments: bool,
    pub auto_retry: bool,
}

#[derive(Debug, Clone)]
pub enum DownloadProgressEvent {
    Started {
        lecture_id: u64,
        total_bytes: Option<u64>,
    },
    Progress {
        lecture_id: u64,
        downloaded_bytes: u64,
        total_bytes: Option<u64>,
        speed_bps: f64,
        eta_secs: Option<u64>,
    },
    Completed {
        lecture_id: u64,
        file_path: PathBuf,
    },
    Failed {
        lecture_id: u64,
        error: String,
    },
    Canceled {
        lecture_id: u64,
    },
}

pub fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            _ => c,
        })
        .collect();
    sanitized.trim().to_string()
}

pub struct Downloader {
    client: Arc<UdemyClient>,
    http_client: reqwest::Client,
    limiter: BandwidthLimiter,
}

impl Downloader {
    pub fn new(client: Arc<UdemyClient>, limiter: BandwidthLimiter) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .unwrap_or_default();
        Self {
            client,
            http_client,
            limiter,
        }
    }

    /// Selects the best video stream URL based on quality preference
    pub fn select_stream_url(
        asset_response: &LectureDetailResponse,
        preferred_quality: &str,
    ) -> Option<(String, String)> {
        let asset = asset_response.asset.as_ref()?;

        let mut video_urls = Vec::new();
        if let Some(dl_urls) = &asset.download_urls {
            if let Some(videos) = &dl_urls.video {
                video_urls.extend(videos.clone());
            }
        }
        if let Some(stream_urls) = &asset.stream_urls {
            if let Some(videos) = &stream_urls.video {
                video_urls.extend(videos.clone());
            }
        }
        if let Some(media_sources) = &asset.media_sources {
            video_urls.extend(media_sources.clone());
        }

        let valid_videos: Vec<DownloadUrl> = video_urls
            .into_iter()
            .filter(|v| v.get_url().is_some())
            .collect();

        if !valid_videos.is_empty() {
            let mut sorted = valid_videos;
            sorted.sort_by(|a, b| {
                let a_res: u32 = a.label.as_deref().unwrap_or("0").parse().unwrap_or(0);
                let b_res: u32 = b.label.as_deref().unwrap_or("0").parse().unwrap_or(0);
                b_res.cmp(&a_res)
            });

            let chosen = match preferred_quality {
                "Highest" | "Auto" => sorted.first(),
                "Lowest" => sorted.last(),
                specific => sorted
                    .iter()
                    .find(|v| v.label.as_deref() == Some(specific))
                    .or_else(|| sorted.first()),
            };

            if let Some(v) = chosen {
                let ext = asset
                    .filename
                    .as_deref()
                    .and_then(|f| Path::new(f).extension().and_then(|e| e.to_str()))
                    .map(|e| format!(".{}", e))
                    .unwrap_or_else(|| ".mp4".to_string());
                return Some((v.get_url()?.to_string(), ext));
            }
        }

        // Check supplementary asset types (documents, archives, external links)
        if let Some(dl_urls) = &asset.download_urls {
            if let Some(files) = &dl_urls.file {
                if let Some(f) = files.first().and_then(|f| f.get_url()) {
                    return Some((f.to_string(), ".bin".to_string()));
                }
            }
            if let Some(ebooks) = &dl_urls.ebook {
                if let Some(e) = ebooks.first().and_then(|e| e.get_url()) {
                    return Some((e.to_string(), ".pdf".to_string()));
                }
            }
        }

        if let Some(ext_url) = &asset.external_url {
            return Some((ext_url.clone(), ".url".to_string()));
        }

        None
    }

    /// Executes the download for a single lecture item
    pub async fn download_item(
        &self,
        req: DownloadItemRequest,
        progress_tx: Option<UnboundedSender<DownloadProgressEvent>>,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<PathBuf, DownloadError> {
        let clean_course = sanitize_filename(&req.course_title);
        let clean_chapter = sanitize_filename(&req.chapter_title);
        let clean_lecture = format!(
            "{:02} - {} [ID_{}]",
            req.lecture_index,
            sanitize_filename(&req.lecture_title),
            req.lecture_id
        );

        let target_dir = req.download_path.join(&clean_course).join(&clean_chapter);
        fs::create_dir_all(&target_dir).await?;

        // Handle quizzes by generating an interactive browser redirect wrapper
        if req.item_type == "Quiz" {
            let file_path = target_dir.join(format!("{}.html", clean_lecture));
            let base = self.client.credentials().base_url();
            let html = format!(
                "<!DOCTYPE html><html><head><meta http-equiv=\"refresh\" content=\"0; url={}/course/{}/learn/quiz/{}\" /></head><body>Redirecting to Udemy Quiz...</body></html>",
                base, req.course_id, req.lecture_id
            );
            fs::write(&file_path, html).await?;
            if let Some(tx) = &progress_tx {
                let _ = tx.send(DownloadProgressEvent::Completed {
                    lecture_id: req.lecture_id,
                    file_path: file_path.clone(),
                });
            }
            return Ok(file_path);
        }

        // Fetch lecture media metadata via API endpoints
        let details = self
            .client
            .fetch_lecture_details(req.course_id, req.lecture_id)
            .await?;

        if cancel_flag.load(Ordering::Relaxed) {
            return Err(DownloadError::Canceled);
        }

        let asset = details
            .asset
            .as_ref()
            .ok_or_else(|| DownloadError::AssetUnavailable("Missing asset metadata".into()))?;

        // Retrieve and store WebVTT closed captions
        if !req.skip_subtitles {
            if let Some(captions) = &asset.captions {
                for cap in captions {
                    if let Some(url) = cap.get_url() {
                        let locale = cap
                            .locale
                            .as_deref()
                            .or(cap.title.as_deref())
                            .unwrap_or("unknown");
                        let clean_locale = sanitize_filename(locale);
                        let sub_path = target_dir.join(format!("{}_{}.vtt", clean_lecture, clean_locale));
                        if !sub_path.exists() {
                            if let Ok(res) = self.http_client.get(url).send().await {
                                if let Ok(text) = res.text().await {
                                    let _ = fs::write(sub_path, text).await;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Retrieve and store supplementary course resources
        if !req.skip_attachments {
            if let Some(supplementary) = &details.supplementary_assets {
                for supp in supplementary {
                    if let (Some(filename), Some(dl_map)) = (&supp.filename, &supp.download_urls) {
                        if let Some(files) = &dl_map.file {
                            if let Some(file_url) = files.first().and_then(|f| f.get_url()) {
                                let supp_path = target_dir.join(sanitize_filename(filename));
                                if !supp_path.exists() {
                                    if let Ok(res) = self.http_client.get(file_url).send().await {
                                        if let Ok(bytes) = res.bytes().await {
                                            let _ = fs::write(supp_path, bytes).await;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Format and serialize text article content to HTML
        if req.item_type == "Article" {
            let file_path = target_dir.join(format!("{}.html", clean_lecture));
            let body_content = asset
                .body
                .as_deref()
                .unwrap_or("<p>No text content provided.</p>");
            let html = format!(
                "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>{}</title><style>body {{ font-family: system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; }} img {{ max-width: 100%; }}</style></head><body><h1>{}</h1><hr/>{}</body></html>",
                req.lecture_title, req.lecture_title, body_content
            );
            fs::write(&file_path, html).await?;
            if let Some(tx) = &progress_tx {
                let _ = tx.send(DownloadProgressEvent::Completed {
                    lecture_id: req.lecture_id,
                    file_path: file_path.clone(),
                });
            }
            return Ok(file_path);
        }

        // Resolve optimal video stream matching requested resolution
        let (stream_url, ext) = Self::select_stream_url(&details, &req.video_quality)
            .ok_or_else(|| DownloadError::AssetUnavailable("No stream URL available (possibly DRM-protected)".into()))?;

        let final_file_path = target_dir.join(format!("{}{}", clean_lecture, ext));
        if final_file_path.exists() {
            if let Some(tx) = &progress_tx {
                let _ = tx.send(DownloadProgressEvent::Completed {
                    lecture_id: req.lecture_id,
                    file_path: final_file_path.clone(),
                });
            }
            return Ok(final_file_path);
        }

        // Initialize temporary download fragment in staging directory (.blobs)
        let blobs_dir = req.download_path.join(".blobs");
        fs::create_dir_all(&blobs_dir).await?;
        let temp_file_path = blobs_dir.join(format!("temp_{}{}.part", req.lecture_id, ext));

        let mut existing_bytes = 0u64;
        if temp_file_path.exists() {
            if let Ok(meta) = fs::metadata(&temp_file_path).await {
                existing_bytes = meta.len();
            }
        }

        // Dispatch HTTP streaming request supporting byte-range resumption
        let mut request = self.http_client.get(&stream_url);
        if existing_bytes > 0 {
            request = request.header("Range", format!("bytes={}-", existing_bytes));
        }

        let response = request.send().await?;
        let status = response.status();

        let (append_mode, total_bytes) = if status == reqwest::StatusCode::PARTIAL_CONTENT {
            let total = response.content_length().map(|l| l + existing_bytes);
            (true, total)
        } else if status.is_success() {
            (false, response.content_length())
        } else {
            return Err(DownloadError::Network(response.error_for_status().unwrap_err()));
        };

        if let Some(tx) = &progress_tx {
            let _ = tx.send(DownloadProgressEvent::Started {
                lecture_id: req.lecture_id,
                total_bytes,
            });
        }

        let mut file = if append_mode {
            OpenOptions::new()
                .create(true)
                .append(true)
                .open(&temp_file_path)
                .await?
        } else {
            existing_bytes = 0;
            OpenOptions::new()
                .create(true)
                .write(true)
                .truncate(true)
                .open(&temp_file_path)
                .await?
        };

        let mut downloaded_bytes = existing_bytes;
        let mut stream = response.bytes_stream();
        let mut last_emit = Instant::now();
        let mut bytes_since_emit = 0u64;

        while let Some(chunk_res) = stream.next().await {
            if cancel_flag.load(Ordering::Relaxed) {
                if let Some(tx) = &progress_tx {
                    let _ = tx.send(DownloadProgressEvent::Canceled {
                        lecture_id: req.lecture_id,
                    });
                }
                return Err(DownloadError::Canceled);
            }

            let chunk = chunk_res?;
            let chunk_len = chunk.len();

            // Enforce token-bucket bandwidth limit
            self.limiter.consume(chunk_len).await;

            file.write_all(&chunk).await?;
            downloaded_bytes += chunk_len as u64;
            bytes_since_emit += chunk_len as u64;

            // Emit progress telemetry at throttled interval (~250ms)
            let elapsed = last_emit.elapsed();
            if elapsed >= std::time::Duration::from_millis(250) {
                let speed_bps = (bytes_since_emit as f64) / elapsed.as_secs_f64();
                let eta_secs = total_bytes.and_then(|tot| {
                    if tot > downloaded_bytes && speed_bps > 0.0 {
                        Some(((tot - downloaded_bytes) as f64 / speed_bps) as u64)
                    } else {
                        None
                    }
                });

                if let Some(tx) = &progress_tx {
                    let _ = tx.send(DownloadProgressEvent::Progress {
                        lecture_id: req.lecture_id,
                        downloaded_bytes,
                        total_bytes,
                        speed_bps,
                        eta_secs,
                    });
                }

                last_emit = Instant::now();
                bytes_since_emit = 0;
            }
        }

        file.flush().await?;
        drop(file);

        // Atomically move completed file from staging to final destination
        fs::rename(&temp_file_path, &final_file_path).await?;

        if let Some(tx) = &progress_tx {
            let _ = tx.send(DownloadProgressEvent::Completed {
                lecture_id: req.lecture_id,
                file_path: final_file_path.clone(),
            });
        }

        Ok(final_file_path)
    }
}
