use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocaleMeta {
    pub code: String,
    pub name: String,
    pub country_code: String,
    pub dir: String,
}

pub struct I18nManager {
    pub locales: Vec<LocaleMeta>,
    dictionaries: HashMap<String, Value>,
}

impl I18nManager {
    pub fn load_from_dir(locales_dir: &Path) -> Self {
        let mut dictionaries = HashMap::new();
        let mut locales = vec![LocaleMeta {
            code: "EnglishUS".to_string(),
            name: "English (US)".to_string(),
            country_code: "us".to_string(),
            dir: "ltr".to_string(),
        }];

        if let Ok(entries) = fs::read_dir(locales_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") {
                    continue;
                }
                let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
                    continue;
                };
                let code = stem.to_string();

                let Ok(raw_text) = fs::read_to_string(&path) else {
                    continue;
                };
                let Ok(parsed_json) = serde_json::from_str::<Value>(&raw_text) else {
                    continue;
                };

                let meta_obj = parsed_json.get("_meta");
                let name = meta_obj
                    .and_then(|m| m.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(&code)
                    .to_string();
                let country_code = meta_obj
                    .and_then(|m| m.get("countryCode"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("us")
                    .to_lowercase();
                let dir = meta_obj
                    .and_then(|m| m.get("dir"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("ltr")
                    .to_string();

                dictionaries.insert(code.clone(), parsed_json);

                if code == "EnglishUS" {
                    if let Some(first) = locales.first_mut() {
                        first.name = name;
                        first.country_code = country_code;
                        first.dir = dir;
                    }
                } else {
                    locales.push(LocaleMeta {
                        code,
                        name,
                        country_code,
                        dir,
                    });
                }
            }
        }

        if locales.len() > 1 {
            locales[1..].sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        }

        Self {
            locales,
            dictionaries,
        }
    }

    pub fn translate(&self, locale_code: &str, dot_path: &str, fallback: &str) -> String {
        if let Some(dict) = self.dictionaries.get(locale_code) {
            if let Some(val) = Self::resolve_path(dict, dot_path) {
                if !val.trim().is_empty() {
                    return val;
                }
            }
        }
        if locale_code != "EnglishUS" {
            if let Some(en_dict) = self.dictionaries.get("EnglishUS") {
                if let Some(val) = Self::resolve_path(en_dict, dot_path) {
                    if !val.trim().is_empty() {
                        return val;
                    }
                }
            }
        }
        fallback.to_string()
    }

    fn resolve_path(root: &Value, path: &str) -> Option<String> {
        let mut current = root;
        for segment in path.split('.') {
            current = current.get(segment)?;
        }
        current.as_str().map(|s| s.to_string())
    }

    pub fn resolve_locales_dir() -> PathBuf {
        let candidates = [
            PathBuf::from("locales"),
            PathBuf::from("src/renderer/src/locales"),
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.join("locales")))
                .unwrap_or_else(|| PathBuf::from("locales")),
            crate::vault::Vault::get_storage_path().join("locales"),
        ];
        for cand in &candidates {
            if cand.is_dir() {
                return cand.clone();
            }
        }
        let fallback = PathBuf::from("locales");
        let _ = fs::create_dir_all(&fallback);
        fallback
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_i18n_discovery_and_fallback() {
        let temp_dir = std::env::temp_dir().join("udeler_i18n_test");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let greek_json = r#"{
            "_meta": {
                "name": "Ελληνικά (GR)",
                "countryCode": "gr",
                "dir": "ltr"
            },
            "views": {
                "login": {
                    "whosLearning": "Ποιος συνδέεται σήμερα;"
                }
            }
        }"#;
        fs::write(temp_dir.join("Greek.json"), greek_json).unwrap();

        let manager = I18nManager::load_from_dir(&temp_dir);
        assert_eq!(manager.locales.len(), 2);
        assert_eq!(manager.locales[0].code, "EnglishUS");
        assert_eq!(manager.locales[1].code, "Greek");
        assert_eq!(manager.locales[1].country_code, "gr");

        // Translated key in Greek
        assert_eq!(
            manager.translate("Greek", "views.login.whosLearning", "Who's learning today?"),
            "Ποιος συνδέεται σήμερα;"
        );

        // Missing key in Greek falls back cleanly to default English string
        assert_eq!(
            manager.translate("Greek", "views.login.missingKey", "Default Fallback"),
            "Default Fallback"
        );

        let _ = fs::remove_dir_all(&temp_dir);
    }
}