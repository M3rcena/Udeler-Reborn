use crate::vault::Vault;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Controls how downloads are organized across multiple Udemy profiles
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum DownloadStorageMode {
    /// All profiles save into `<download_path>/<Course Title>`
    #[default]
    SharedPool = 0,
    /// Profiles save into `<download_path>/<Profile Name>/<Course Title>`
    OrganizedSubfolders = 1,
    /// Each profile can specify its own custom folder path
    SeparatePerProfile = 2,
}

impl DownloadStorageMode {
    pub fn from_index(idx: i32) -> Self {
        match idx {
            1 => Self::OrganizedSubfolders,
            2 => Self::SeparatePerProfile,
            _ => Self::SharedPool,
        }
    }

    pub fn to_index(self) -> i32 {
        match self {
            Self::SharedPool => 0,
            Self::OrganizedSubfolders => 1,
            Self::SeparatePerProfile => 2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SavedProfile {
    pub id: String,
    pub name: String,
    pub subdomain: Option<String>,
    pub avatar_url: Option<String>,
    pub encrypted_token: String,
    pub color_index: usize,
    #[serde(default)]
    pub custom_download_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppSettings {
    pub download_path: PathBuf,
    #[serde(default)]
    pub storage_mode: DownloadStorageMode,
    pub video_quality: String,
    pub skip_subtitles: bool,
    pub skip_attachments: bool,
    pub auto_retry: bool,
    pub max_concurrent_downloads: usize,
    pub speed_limit_kb: Option<u64>,
    #[serde(default)]
    pub schedule_enabled: bool,
    #[serde(default = "default_schedule_start")]
    pub schedule_start: String,
    #[serde(default = "default_schedule_end")]
    pub schedule_end: String,
    #[serde(default)]
    pub close_to_tray: bool,
    #[serde(default)]
    pub vault_mode: bool,
    pub subdomain: Option<String>,
    #[serde(default = "default_language")]
    pub language: String,
    pub dark_mode: bool,
    #[serde(default)]
    pub theme_preset: usize,
    #[serde(default)]
    pub profiles: Vec<SavedProfile>,
    #[serde(default)]
    pub active_profile_id: Option<String>,
}

fn default_schedule_start() -> String {
    "01:00".to_string()
}

fn default_schedule_end() -> String {
    "06:00".to_string()
}

fn default_language() -> String {
    "EnglishUS".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            download_path: Self::resolve_default_download_path(),
            storage_mode: DownloadStorageMode::SharedPool,
            video_quality: "Auto".to_string(),
            skip_subtitles: false,
            skip_attachments: false,
            auto_retry: true,
            max_concurrent_downloads: 3,
            speed_limit_kb: None,
            schedule_enabled: false,
            schedule_start: default_schedule_start(),
            schedule_end: default_schedule_end(),
            close_to_tray: false,
            vault_mode: false,
            subdomain: None,
            language: default_language(),
            dark_mode: true,
            theme_preset: 0,
            profiles: Vec::new(),
            active_profile_id: None,
        }
    }
}

impl AppSettings {
    pub const MAX_PROFILES: usize = 5;

    pub fn resolve_default_download_path() -> PathBuf {
        if let Some(user_dirs) = directories::UserDirs::new() {
            if let Some(download_dir) = user_dirs.download_dir() {
                return download_dir.join("Udeler");
            }
            if let Some(video_dir) = user_dirs.video_dir() {
                return video_dir.join("Udeler");
            }
            return user_dirs.home_dir().join("Udeler");
        }
        PathBuf::from("Udeler_Downloads")
    }

    /// Resolves the target download directory for the currently active profile
    /// according to `storage_mode` (SharedPool, OrganizedSubfolders, or SeparatePerProfile).
    pub fn resolve_effective_download_path(&self) -> PathBuf {
        let active_prof = self
            .active_profile_id
            .as_deref()
            .and_then(|id| self.profiles.iter().find(|p| p.id == id));

        match self.storage_mode {
            DownloadStorageMode::SharedPool => self.download_path.clone(),
            DownloadStorageMode::OrganizedSubfolders => {
                if let Some(prof) = active_prof {
                    let safe_name: String = prof
                        .name
                        .chars()
                        .map(|c| match c {
                            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
                            _ => c,
                        })
                        .collect();
                    let folder = safe_name.trim();
                    if !folder.is_empty() {
                        return self.download_path.join(folder);
                    }
                }
                self.download_path.clone()
            }
            DownloadStorageMode::SeparatePerProfile => {
                if let Some(prof) = active_prof {
                    if let Some(custom) = &prof.custom_download_path {
                        if !custom.as_os_str().is_empty() {
                            return custom.clone();
                        }
                    }
                }
                self.download_path.clone()
            }
        }
    }

    /// Checks whether the current local clock time falls inside `[schedule_start, schedule_end)`
    pub fn is_within_schedule_window(&self, current_hour: u32, current_min: u32) -> bool {
        if !self.schedule_enabled {
            return true;
        }
        let parse_hm = |s: &str| -> Option<u32> {
            let (h, m) = s.trim().split_once(':')?;
            let hh: u32 = h.parse().ok()?;
            let mm: u32 = m.parse().ok()?;
            Some(hh.min(23) * 60 + mm.min(59))
        };

        let Some(start_mins) = parse_hm(&self.schedule_start) else {
            return true;
        };
        let Some(end_mins) = parse_hm(&self.schedule_end) else {
            return true;
        };
        let now_mins = current_hour * 60 + current_min;

        if start_mins < end_mins {
            now_mins >= start_mins && now_mins < end_mins
        } else {
            now_mins >= start_mins || now_mins < end_mins
        }
    }

    pub fn load() -> Self {
        let path = Self::settings_file_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(mut settings) = serde_json::from_str::<AppSettings>(&content) {
                    if settings.download_path.as_os_str().is_empty() {
                        settings.download_path = Self::resolve_default_download_path();
                    }
                    if settings.profiles.len() > Self::MAX_PROFILES {
                        settings.profiles.truncate(Self::MAX_PROFILES);
                    }
                    return settings;
                }
            }
        }
        let default_settings = Self::default();
        let _ = default_settings.save();
        default_settings
    }

    pub fn save(&self) -> Result<(), std::io::Error> {
        let path = Self::settings_file_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        fs::write(path, json)
    }

    fn settings_file_path() -> PathBuf {
        Vault::get_storage_path().join("settings.json")
    }

    pub fn upsert_profile(
        &mut self,
        vault: &Vault,
        name: String,
        subdomain: Option<String>,
        avatar_url: Option<String>,
        raw_token: &str,
    ) -> Result<SavedProfile, String> {
        let encrypted_token = vault.encrypt(raw_token.trim())?;
        let clean_sub = subdomain
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty());

        if let Some(existing) = self
            .profiles
            .iter_mut()
            .find(|p| p.name.eq_ignore_ascii_case(&name) && p.subdomain == clean_sub)
        {
            existing.encrypted_token = encrypted_token;
            if avatar_url.is_some() {
                existing.avatar_url = avatar_url;
            }
            let updated = existing.clone();
            self.active_profile_id = Some(updated.id.clone());
            self.subdomain = clean_sub;
            let _ = self.save();
            return Ok(updated);
        }

        if self.profiles.len() >= Self::MAX_PROFILES {
            return Err("Maximum of 5 accounts reached. Remove an existing profile first.".into());
        }

        let seed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let id = format!("prof_{}", seed);
        let color_index = self.profiles.len() % 5;

        let profile = SavedProfile {
            id: id.clone(),
            name,
            subdomain: clean_sub.clone(),
            avatar_url,
            encrypted_token,
            color_index,
            custom_download_path: None,
        };

        self.profiles.push(profile.clone());
        self.active_profile_id = Some(id);
        self.subdomain = clean_sub;
        let _ = self.save();
        Ok(profile)
    }

    pub fn set_active_profile_custom_path(&mut self, custom_path: Option<PathBuf>) {
        if let Some(active_id) = &self.active_profile_id {
            if let Some(prof) = self.profiles.iter_mut().find(|p| &p.id == active_id) {
                prof.custom_download_path = custom_path;
                let _ = self.save();
            }
        }
    }

    pub fn remove_profile(&mut self, profile_id: &str) {
        self.profiles.retain(|p| p.id != profile_id);
        if self.active_profile_id.as_deref() == Some(profile_id) {
            self.active_profile_id = None;
        }
        let _ = self.save();
    }

    pub fn decrypt_profile_token(
        &self,
        vault: &Vault,
        profile_id: &str,
    ) -> Option<(SavedProfile, String)> {
        let prof = self.profiles.iter().find(|p| p.id == profile_id)?;
        let token = vault.decrypt(&prof.encrypted_token).ok()?;
        if token.trim().is_empty() {
            return None;
        }
        Some((prof.clone(), token))
    }

    pub fn load_saved_token(vault: &Vault) -> Option<String> {
        let token_path = Vault::get_storage_path().join("token.vault");
        if token_path.exists() {
            if let Ok(encrypted) = fs::read_to_string(token_path) {
                if let Ok(decrypted) = vault.decrypt(&encrypted) {
                    if !decrypted.is_empty() {
                        return Some(decrypted);
                    }
                }
            }
        }
        None
    }

    pub fn save_token(vault: &Vault, token: &str) -> Result<(), std::io::Error> {
        let token_path = Vault::get_storage_path().join("token.vault");
        if token.trim().is_empty() {
            if token_path.exists() {
                let _ = fs::remove_file(token_path);
            }
            return Ok(());
        }
        match vault.encrypt(token.trim()) {
            Ok(encrypted) => fs::write(token_path, encrypted),
            Err(e) => Err(std::io::Error::new(std::io::ErrorKind::Other, e)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_download_path() {
        let default_path = AppSettings::resolve_default_download_path();
        assert!(!default_path.as_os_str().is_empty());
        assert!(default_path.ends_with("Udeler"));
    }

    #[test]
    fn test_storage_mode_effective_paths() {
        let vault = Vault::new();
        let mut settings = AppSettings::default();
        settings.download_path = PathBuf::from("/tmp/udeler_base");

        let prof = settings
            .upsert_profile(&vault, "Work Account".into(), Some("acme".into()), None, "tok_123")
            .expect("profile created");

        // Mode 0: SharedPool -> /tmp/udeler_base
        settings.storage_mode = DownloadStorageMode::SharedPool;
        assert_eq!(
            settings.resolve_effective_download_path(),
            PathBuf::from("/tmp/udeler_base")
        );

        // Mode 1: OrganizedSubfolders -> /tmp/udeler_base/Work Account
        settings.storage_mode = DownloadStorageMode::OrganizedSubfolders;
        assert_eq!(
            settings.resolve_effective_download_path(),
            PathBuf::from("/tmp/udeler_base/Work Account")
        );

        // Mode 2: SeparatePerProfile -> custom path if set, else fallback to base
        settings.storage_mode = DownloadStorageMode::SeparatePerProfile;
        assert_eq!(
            settings.resolve_effective_download_path(),
            PathBuf::from("/tmp/udeler_base")
        );

        settings.set_active_profile_custom_path(Some(PathBuf::from("/mnt/ssd/work_udemy")));
        assert_eq!(
            settings.resolve_effective_download_path(),
            PathBuf::from("/mnt/ssd/work_udemy")
        );

        settings.remove_profile(&prof.id);
        assert!(settings.profiles.is_empty());
    }

    #[test]
    fn test_max_five_profiles_limit() {
        let vault = Vault::new();
        let mut settings = AppSettings::default();

        for i in 1..=5 {
            let res = settings.upsert_profile(
                &vault,
                format!("User {}", i),
                None,
                None,
                &format!("token_{}", i),
            );
            assert!(res.is_ok());
        }
        assert_eq!(settings.profiles.len(), 5);

        // 6th distinct profile must be rejected
        let sixth = settings.upsert_profile(&vault, "User 6".into(), None, None, "token_6");
        assert!(sixth.is_err());

        // Updating an existing profile (User 3) must still succeed
        let update_existing =
            settings.upsert_profile(&vault, "User 3".into(), None, None, "new_token_3");
        assert!(update_existing.is_ok());
        assert_eq!(settings.profiles.len(), 5);
    }

    #[test]
    fn test_schedule_window_evaluation() {
        let mut settings = AppSettings::default();
        settings.schedule_enabled = true;
        settings.schedule_start = "01:00".into();
        settings.schedule_end = "06:00".into();

        assert!(settings.is_within_schedule_window(2, 30));
        assert!(!settings.is_within_schedule_window(14, 0));

        // Overnight wrap-around window (22:00 -> 04:00)
        settings.schedule_start = "22:00".into();
        settings.schedule_end = "04:00".into();
        assert!(settings.is_within_schedule_window(23, 15));
        assert!(settings.is_within_schedule_window(1, 45));
        assert!(!settings.is_within_schedule_window(12, 0));
    }
}