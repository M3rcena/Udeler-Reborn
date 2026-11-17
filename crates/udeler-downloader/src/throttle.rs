use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

/// Token-bucket bandwidth rate limiter for asynchronous I/O streams.
#[derive(Clone)]
pub struct BandwidthLimiter {
    bytes_per_sec: Arc<AtomicU64>,
    state: Arc<Mutex<LimiterState>>,
}

struct LimiterState {
    tokens: f64,
    last_update: Instant,
}

impl BandwidthLimiter {
    pub fn new(kb_per_sec: Option<u64>) -> Self {
        let bps = kb_per_sec.unwrap_or(0) * 1024;
        Self {
            bytes_per_sec: Arc::new(AtomicU64::new(bps)),
            state: Arc::new(Mutex::new(LimiterState {
                tokens: bps as f64,
                last_update: Instant::now(),
            })),
        }
    }

    pub fn set_limit_kb(&self, kb_per_sec: Option<u64>) {
        let bps = kb_per_sec.unwrap_or(0) * 1024;
        self.bytes_per_sec.store(bps, Ordering::Relaxed);
    }

    /// Consumes byte tokens, sleeping asynchronously if the rate limit bucket is depleted.
    pub async fn consume(&self, bytes: usize) {
        let max_rate = self.bytes_per_sec.load(Ordering::Relaxed);
        if max_rate == 0 || bytes == 0 {
            return; // Bandwidth throttling is disabled when limit is 0
        }

        let max_rate_f = max_rate as f64;
        let requested = bytes as f64;

        loop {
            let sleep_duration = {
                let mut state = self.state.lock().await;
                let now = Instant::now();
                let elapsed = now.duration_since(state.last_update).as_secs_f64();
                state.last_update = now;

                // Replenish available tokens based on elapsed duration
                state.tokens = (state.tokens + elapsed * max_rate_f).min(max_rate_f * 2.0);

                if state.tokens >= requested {
                    state.tokens -= requested;
                    None
                } else {
                    let needed = requested - state.tokens;
                    let wait_secs = needed / max_rate_f;
                    Some(Duration::from_secs_f64(wait_secs.min(1.0)))
                }
            };

            match sleep_duration {
                Some(dur) => sleep(dur).await,
                None => break,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_unlimited_limiter() {
        let limiter = BandwidthLimiter::new(None);
        let start = Instant::now();
        limiter.consume(1_000_000).await;
        assert!(start.elapsed() < Duration::from_millis(50));
    }
}
