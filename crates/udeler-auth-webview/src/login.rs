use futures_util::{SinkExt, StreamExt};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;
use thiserror::Error;
use tokio::process::Command;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::info;
use udeler_core::api::{ApiError, UdemyClient};
use udeler_core::auth::AuthCredentials;
use udeler_core::models::UserProfile;

#[derive(Error, Debug)]
pub enum LoginError {
    #[error("API error: {0}")]
    Api(#[from] ApiError),
    #[error("Token is empty or invalid")]
    EmptyToken,
    #[error("No Chromium-based browser (Chrome, Chromium, Brave, Edge, Vivaldi, Opera) found. Please use 'How to find your token' for Manual Login.")]
    NoBrowserFound,
    #[error("Failed to initialize login window: {0}")]
    WindowError(String),
    #[error("Login window was closed before authentication")]
    Canceled,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub struct AuthService;

impl AuthService {
    /// Validates an access token (or raw cookie header) and fetches corresponding user profile details.
    pub async fn validate_token(
        raw_token: &str,
        subdomain: Option<String>,
    ) -> Result<(AuthCredentials, UserProfile), LoginError> {
        let creds = AuthCredentials::new(raw_token, subdomain);
        if creds.is_empty() {
            return Err(LoginError::EmptyToken);
        }
        let client = UdemyClient::new(creds.clone())?;
        let profile = client.verify_token().await?;
        Ok((creds, profile))
    }

    /// Resolves executable binary paths via the system PATH environment variable without external dependencies.
    fn find_in_path(bin_name: &str) -> Option<PathBuf> {
        if let Some(paths) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&paths) {
                let candidate = dir.join(bin_name);
                if candidate.is_file() {
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        if let Ok(meta) = candidate.metadata() {
                            if meta.permissions().mode() & 0o111 != 0 {
                                return Some(candidate);
                            }
                        }
                    }
                    #[cfg(not(unix))]
                    {
                        return Some(candidate);
                    }
                }
            }
        }
        None
    }

    /// Discovers an installed Chromium-based browser on the system.
    pub fn find_chromium_binary() -> Option<PathBuf> {
        // Check environment variable overrides for custom browser executable path
        for env_var in ["CHROME_BIN", "UDELER_BROWSER", "BROWSER"] {
            if let Ok(val) = std::env::var(env_var) {
                let p = PathBuf::from(val.trim());
                if p.is_file() {
                    return Some(p);
                }
                if let Some(in_path) = Self::find_in_path(val.trim()) {
                    return Some(in_path);
                }
            }
        }

        // Probe standard platform-specific installation paths and default associations
        #[cfg(target_os = "linux")]
        {
            if let Some(default_bin) = Self::detect_linux_default_browser() {
                return Some(default_bin);
            }

            let candidates = [
                "google-chrome",
                "google-chrome-stable",
                "chromium",
                "chromium-browser",
                "brave-browser",
                "brave",
                "microsoft-edge-stable",
                "microsoft-edge",
                "vivaldi-stable",
                "vivaldi",
                "opera",
            ];
            for bin in candidates {
                if let Some(p) = Self::find_in_path(bin) {
                    return Some(p);
                }
            }

            let system_paths = [
                "/usr/bin/google-chrome",
                "/usr/bin/google-chrome-stable",
                "/usr/bin/chromium",
                "/usr/bin/chromium-browser",
                "/usr/bin/brave-browser",
                "/usr/bin/microsoft-edge-stable",
                "/usr/bin/microsoft-edge",
                "/usr/bin/vivaldi",
                "/usr/bin/opera",
                "/opt/google/chrome/google-chrome",
                "/opt/brave.com/brave/brave-browser",
                "/opt/microsoft/msedge/msedge",
                "/snap/bin/chromium",
                "/snap/bin/brave",
                "/snap/bin/google-chrome",
                "/snap/bin/microsoft-edge",
                "/var/lib/snapd/snap/bin/chromium",
                "/var/lib/flatpak/exports/bin/com.google.Chrome",
                "/var/lib/flatpak/exports/bin/org.chromium.Chromium",
                "/var/lib/flatpak/exports/bin/com.brave.Browser",
                "/var/lib/flatpak/exports/bin/com.microsoft.Edge",
            ];
            for path_str in system_paths {
                let p = PathBuf::from(path_str);
                if p.is_file() {
                    return Some(p);
                }
            }

            if let Some(home) = directories::BaseDirs::new().map(|b| b.home_dir().to_path_buf()) {
                let user_flatpaks = [
                    home.join(".local/share/flatpak/exports/bin/com.google.Chrome"),
                    home.join(".local/share/flatpak/exports/bin/org.chromium.Chromium"),
                    home.join(".local/share/flatpak/exports/bin/com.brave.Browser"),
                    home.join(".local/share/flatpak/exports/bin/com.microsoft.Edge"),
                ];
                for fp in user_flatpaks {
                    if fp.is_file() {
                        return Some(fp);
                    }
                }
            }
            None
        }

        #[cfg(target_os = "windows")]
        {
            let candidates = ["chrome.exe", "msedge.exe", "brave.exe", "vivaldi.exe", "opera.exe"];
            for bin in candidates {
                if let Some(p) = Self::find_in_path(bin) {
                    return Some(p);
                }
            }

            let program_files =
                std::env::var("PROGRAMFILES").unwrap_or_else(|_| "C:\\Program Files".into());
            let program_files_x86 = std::env::var("PROGRAMFILES(X86)")
                .unwrap_or_else(|_| "C:\\Program Files (x86)".into());
            let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();

            let paths = [
                format!("{}\\Google\\Chrome\\Application\\chrome.exe", program_files),
                format!("{}\\Google\\Chrome\\Application\\chrome.exe", program_files_x86),
                format!("{}\\Google\\Chrome\\Application\\chrome.exe", local_app_data),
                format!("{}\\Microsoft\\Edge\\Application\\msedge.exe", program_files_x86),
                format!("{}\\Microsoft\\Edge\\Application\\msedge.exe", program_files),
                format!("{}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe", program_files),
                format!("{}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe", program_files_x86),
                format!("{}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe", local_app_data),
                format!("{}\\Vivaldi\\Application\\vivaldi.exe", program_files),
                format!("{}\\Vivaldi\\Application\\vivaldi.exe", local_app_data),
                format!("{}\\Programs\\Opera\\opera.exe", local_app_data),
            ];
            paths.into_iter().map(PathBuf::from).find(|p| p.is_file())
        }

        #[cfg(target_os = "macos")]
        {
            let mac_paths = [
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
                "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
                "/Applications/Chromium.app/Contents/MacOS/Chromium",
                "/Applications/Arc.app/Contents/MacOS/Arc",
                "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi",
                "/Applications/Opera.app/Contents/MacOS/Opera",
            ];
            for path in mac_paths {
                let p = PathBuf::from(path);
                if p.is_file() {
                    return Some(p);
                }
            }
            if let Some(home) = directories::BaseDirs::new().map(|b| b.home_dir().to_path_buf()) {
                let user_apps = [
                    home.join("Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
                    home.join("Applications/Brave Browser.app/Contents/MacOS/Brave Browser"),
                    home.join("Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
                    home.join("Applications/Chromium.app/Contents/MacOS/Chromium"),
                ];
                for ua in user_apps {
                    if ua.is_file() {
                        return Some(ua);
                    }
                }
            }
            None
        }
    }

    #[cfg(target_os = "linux")]
    fn detect_linux_default_browser() -> Option<PathBuf> {
        let desktop_file = std::process::Command::new("xdg-settings")
            .args(["get", "default-web-browser"])
            .output()
            .ok()
            .and_then(|out| {
                if out.status.success() {
                    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !s.is_empty() {
                        return Some(s);
                    }
                }
                None
            })
            .or_else(|| {
                std::process::Command::new("xdg-mime")
                    .args(["query", "default", "x-scheme-handler/https"])
                    .output()
                    .ok()
                    .and_then(|out| {
                        if out.status.success() {
                            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                            if !s.is_empty() {
                                return Some(s);
                            }
                        }
                        None
                    })
            });

        if let Some(entry) = desktop_file {
            let lower = entry.to_lowercase();
            let bin_name = if lower.contains("google-chrome") {
                Some("google-chrome")
            } else if lower.contains("chromium") {
                Some("chromium")
            } else if lower.contains("brave") {
                Some("brave-browser")
            } else if lower.contains("edge") {
                Some("microsoft-edge")
            } else if lower.contains("vivaldi") {
                Some("vivaldi")
            } else if lower.contains("opera") {
                Some("opera")
            } else {
                None
            };
            if let Some(bin) = bin_name {
                if let Some(p) = Self::find_in_path(bin) {
                    return Some(p);
                }
            }
        }
        None
    }

    fn find_free_port() -> Result<u16, std::io::Error> {
        let listener = TcpListener::bind("127.0.0.1:0")?;
        Ok(listener.local_addr()?.port())
    }

    /// Launches a temporary one-shot browser window for login, captures `access_token` and
    /// accompanying Udemy session cookies via Chrome DevTools Protocol (`Storage.getCookies`),
    /// validates the session live, and closes/deletes the temporary browser profile.
    pub async fn spawn_login_popup(
        subdomain: Option<String>,
    ) -> Result<(String, UserProfile), LoginError> {
        let browser_bin = Self::find_chromium_binary().ok_or(LoginError::NoBrowserFound)?;
        let port = Self::find_free_port()?;

        let target_url = match &subdomain {
            Some(sub) if !sub.trim().is_empty() => format!("https://{}.udemy.com/", sub.trim()),
            _ => "https://www.udemy.com/join/login-popup/".to_string(),
        };

        let temp_profile = std::env::temp_dir().join(format!("udeler_auth_{}", port));
        let _ = tokio::fs::remove_dir_all(&temp_profile).await;
        let _ = tokio::fs::create_dir_all(&temp_profile).await;

        info!(
            "Launching one-shot login browser {:?} on CDP port {} targeting {}",
            browser_bin, port, target_url
        );

        let mut child = Command::new(&browser_bin)
            .arg(format!("--remote-debugging-port={}", port))
            .arg("--remote-allow-origins=*")
            .arg(format!("--user-data-dir={}", temp_profile.display()))
            .arg(format!("--app={}", target_url))
            .arg("--window-size=560,780")
            .arg("--no-first-run")
            .arg("--no-default-browser-check")
            .arg("--disable-sync")
            .arg("--disable-extensions")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| LoginError::WindowError(e.to_string()))?;

        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .unwrap_or_default();

        let version_url = format!("http://127.0.0.1:{}/json/version", port);
        let mut ws_url: Option<String> = None;

        for _ in 0..48 {
            if let Ok(Some(_)) = child.try_wait() {
                let _ = tokio::fs::remove_dir_all(&temp_profile).await;
                return Err(LoginError::Canceled);
            }
            if let Ok(resp) = http.get(&version_url).send().await {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(u) = json.get("webSocketDebuggerUrl").and_then(|v| v.as_str()) {
                        ws_url = Some(u.to_string());
                        break;
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }

        let Some(ws_endpoint) = ws_url else {
            let _ = child.kill().await;
            let _ = tokio::fs::remove_dir_all(&temp_profile).await;
            return Err(LoginError::WindowError(
                "Timed out waiting for login browser to start remote debugging.".into(),
            ));
        };

        info!("Connected to browser CDP WebSocket: {}", ws_endpoint);
        let result = Self::poll_cdp_for_token(&ws_endpoint, &mut child, subdomain).await;

        let _ = child.kill().await;
        let _ = child.wait().await;
        tokio::time::sleep(Duration::from_millis(250)).await;
        let _ = tokio::fs::remove_dir_all(&temp_profile).await;

        result
    }

    /// Polls Chrome DevTools Protocol via WebSocket for `access_token` and all `.udemy.com` cookies
    async fn poll_cdp_for_token(
        ws_endpoint: &str,
        child: &mut tokio::process::Child,
        subdomain: Option<String>,
    ) -> Result<(String, UserProfile), LoginError> {
        let (mut ws_stream, _) = connect_async(ws_endpoint)
            .await
            .map_err(|e| LoginError::WindowError(format!("CDP WebSocket connection error: {}", e)))?;

        let mut req_id = 1u64;
        let mut seen_invalid_tokens = std::collections::HashSet::new();

        loop {
            if let Ok(Some(_)) = child.try_wait() {
                return Err(LoginError::Canceled);
            }

            let cmd = serde_json::json!({
                "id": req_id,
                "method": "Storage.getCookies"
            });

            if ws_stream
                .send(Message::Text(cmd.to_string().into()))
                .await
                .is_err()
            {
                return Err(LoginError::Canceled);
            }

            let expected_id = req_id;
            req_id += 1;

            let deadline = tokio::time::Instant::now() + Duration::from_millis(1500);
            while tokio::time::Instant::now() < deadline {
                let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
                if remaining.is_zero() {
                    break;
                }

                match tokio::time::timeout(remaining, ws_stream.next()).await {
                    Ok(Some(Ok(Message::Text(text)))) => {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                            if val.get("id").and_then(|id| id.as_u64()) == Some(expected_id) {
                                if let Some(cookies) = val
                                    .get("result")
                                    .and_then(|r| r.get("cookies"))
                                    .and_then(|c| c.as_array())
                                {
                                    for cookie in cookies {
                                        let name = cookie
                                            .get("name")
                                            .and_then(|n| n.as_str())
                                            .unwrap_or("");
                                        let domain = cookie
                                            .get("domain")
                                            .and_then(|d| d.as_str())
                                            .unwrap_or("");
                                        let raw_val = cookie
                                            .get("value")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("");
                                        let clean_val = udeler_core::auth::sanitize_token(raw_val);

                                        if (name == "access_token" || name == "bearer_token")
                                            && (domain.is_empty() || domain.contains("udemy"))
                                            && clean_val.len() > 10
                                            && clean_val != "deleted"
                                            && clean_val != "null"
                                        {
                                            if !seen_invalid_tokens.contains(&clean_val) {
                                                let prefix: String = clean_val.chars().take(4).collect();
                                                info!(
                                                    "Intercepted candidate token (domain: '{}', prefix: {}***, len: {}). Validating with Udemy...",
                                                    domain,
                                                    prefix,
                                                    clean_val.len()
                                                );

                                                match Self::validate_token(&clean_val, subdomain.clone()).await {
                                                    Ok((creds, profile)) => {
                                                        info!(
                                                            "Token verified successfully for user: {:?}",
                                                            profile.title
                                                        );
                                                        return Ok((creds.token, profile));
                                                    }
                                                    Err(e) => {
                                                        info!(
                                                            "Candidate token not yet valid ({}). User may still be completing login. Continuing...",
                                                            e
                                                        );
                                                        seen_invalid_tokens.insert(clean_val);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                break;
                            }
                        }
                    }
                    Ok(Some(Ok(Message::Close(_)))) | Ok(None) => {
                        return Err(LoginError::Canceled);
                    }
                    Ok(Some(Err(_))) => {
                        return Err(LoginError::Canceled);
                    }
                    Err(_) => {
                        break;
                    }
                    _ => {}
                }
            }

            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_in_path() {
        assert!(AuthService::find_in_path("sh").is_some());
    }

    #[test]
    fn test_find_chromium_binary() {
        let browser = AuthService::find_chromium_binary();
        assert!(
            browser.is_some(),
            "Expected to discover at least one installed browser"
        );
        let path = browser.unwrap();
        assert!(
            path.is_file(),
            "Discovered browser path should exist as a file"
        );
    }
}