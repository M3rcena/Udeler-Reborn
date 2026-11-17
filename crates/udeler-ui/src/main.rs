slint::include_modules!();

use slint::{ComponentHandle, Model, ModelRc, VecModel};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use tokio::sync::Mutex as TokioMutex;
use tracing::info;
use udeler_auth_webview::login::{AuthService, LoginError};
use udeler_core::api::UdemyClient;
use udeler_core::auth::AuthCredentials;
use udeler_core::i18n::I18nManager;
use udeler_core::models::UdemyCourse;
use udeler_core::settings::{AppSettings, DownloadStorageMode, SavedProfile};
use udeler_core::vault::Vault;
use udeler_downloader::downloader::DownloadItemRequest;
use udeler_downloader::queue::{DownloadQueueManager, QueueStatus};
use udeler_downloader::throttle::BandwidthLimiter;

fn compute_initials(name: &str) -> String {
    let parts: Vec<&str> = name.split_whitespace().collect();
    if parts.len() >= 2 {
        let f = parts[0].chars().next().unwrap_or('U');
        let l = parts[1].chars().next().unwrap_or('L');
        format!("{}{}", f, l).to_uppercase()
    } else {
        name.chars().take(2).collect::<String>().to_uppercase()
    }
}

fn to_profile_items(profiles: &[SavedProfile]) -> Vec<ProfileItem> {
    profiles
        .iter()
        .map(|p| ProfileItem {
            id: p.id.as_str().into(),
            name: p.name.as_str().into(),
            initials: compute_initials(&p.name).into(),
            subdomain: p.subdomain.as_deref().unwrap_or("").into(),
            is_business: p.subdomain.is_some(),
            avatar: slint::Image::default(),
            has_avatar: false,
            color_index: p.color_index as i32,
        })
        .collect()
}

fn spawn_avatar_loader(weak_window: slint::Weak<MainWindow>, profiles: Vec<SavedProfile>) {
    tokio::spawn(async move {
        let cache_dir = directories::BaseDirs::new()
            .map(|b| b.cache_dir().to_path_buf())
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join("udeler")
            .join("avatars");
        let _ = tokio::fs::create_dir_all(&cache_dir).await;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_default();

        for prof in profiles {
            let Some(avatar_url) = prof.avatar_url else { continue };
            if avatar_url.trim().is_empty() || avatar_url.contains("anonymous") {
                continue;
            }

            let file_path = cache_dir.join(format!("{}.jpg", prof.id));
            if !file_path.exists() {
                if let Ok(resp) = client.get(&avatar_url).send().await {
                    if let Ok(bytes) = resp.bytes().await {
                        let _ = tokio::fs::write(&file_path, bytes).await;
                    }
                }
            }

            if file_path.exists() {
                let weak = weak_window.clone();
                let prof_id = prof.id.clone();
                let target_path = file_path.clone();
                let _ = slint::invoke_from_event_loop(move || {
                    if let Some(ui) = weak.upgrade() {
                        if let Ok(loaded_img) = slint::Image::load_from_path(&target_path) {
                            let model = ui.get_profiles();
                            for i in 0..model.row_count() {
                                if let Some(mut item) = model.row_data(i) {
                                    if item.id.as_str() == prof_id {
                                        item.avatar = loaded_img;
                                        item.has_avatar = true;
                                        model.set_row_data(i, item);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    });
}

fn to_course_items(courses: &[UdemyCourse]) -> Vec<CourseItem> {
    courses
        .iter()
        .map(|c| CourseItem {
            id: c.id as i32,
            title: c.title.as_str().into(),
            image_url: c.image_url.as_deref().unwrap_or("").into(),
            thumb: slint::Image::default(),
            url: c.url.as_str().into(),
            selected: false,
        })
        .collect()
}

fn spawn_thumbnail_loader(weak_window: slint::Weak<MainWindow>, courses: Vec<UdemyCourse>) {
    tokio::spawn(async move {
        let cache_dir = directories::BaseDirs::new()
            .map(|b| b.cache_dir().to_path_buf())
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join("udeler")
            .join("thumbnails");
        let _ = tokio::fs::create_dir_all(&cache_dir).await;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_default();

        for course in courses {
            let Some(img_url) = course.image_url else { continue };
            if img_url.trim().is_empty() {
                continue;
            }
            let file_path = cache_dir.join(format!("{}.jpg", course.id));

            if !file_path.exists() {
                if let Ok(resp) = client.get(&img_url).send().await {
                    if let Ok(bytes) = resp.bytes().await {
                        let _ = tokio::fs::write(&file_path, bytes).await;
                    }
                }
            }

            if file_path.exists() {
                let weak = weak_window.clone();
                let course_id = course.id as i32;
                let target_path = file_path.clone();
                let _ = slint::invoke_from_event_loop(move || {
                    if let Some(ui) = weak.upgrade() {
                        if let Ok(loaded_img) = slint::Image::load_from_path(&target_path) {
                            let current_model = ui.get_courses();
                            for i in 0..current_model.row_count() {
                                if let Some(mut item) = current_model.row_data(i) {
                                    if item.id == course_id {
                                        item.thumb = loaded_img;
                                        current_model.set_row_data(i, item);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    });
}

struct AppState {
    client: Option<Arc<UdemyClient>>,
    queue_manager: Option<DownloadQueueManager>,
    limiter: BandwidthLimiter,
    settings: AppSettings,
    all_courses: Vec<UdemyCourse>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    info!("Starting Udeler Reborn v4 (Pure Rust)...");

    let vault = Arc::new(Vault::new());
    let mut settings = AppSettings::load();

    if settings.download_path.as_os_str().is_empty() {
        settings.download_path = AppSettings::resolve_default_download_path();
        let _ = settings.save();
    }

    // Normalize legacy language code
    if settings.language == "en-US" || settings.language.trim().is_empty() {
        settings.language = "EnglishUS".to_string();
        let _ = settings.save();
    }

    // Migrate legacy single token into profiles if profiles list is empty
    if settings.profiles.is_empty() {
        if let Some(legacy_token) = AppSettings::load_saved_token(&vault) {
            let creds = AuthCredentials::new(&legacy_token, settings.subdomain.clone());
            if !creds.is_empty() {
                if let Ok(client) = UdemyClient::new(creds.clone()) {
                    if let Ok(profile) = client.verify_token().await {
                        let display_name = profile.title.unwrap_or_else(|| "Learner".into());
                        let _ = settings.upsert_profile(
                            &vault,
                            display_name,
                            settings.subdomain.clone(),
                            profile.image_50x50,
                            &creds.token,
                        );
                        let _ = AppSettings::save_token(&vault, "");
                    }
                }
            }
        }
    }

    let limiter = BandwidthLimiter::new(settings.speed_limit_kb);
    let app_window = MainWindow::new()?;

    // Always start maximized
    app_window.window().set_maximized(true);

    // Initialize dynamic localization from `locales/` directory
    let locales_dir = I18nManager::resolve_locales_dir();
    let i18n = Arc::new(I18nManager::load_from_dir(&locales_dir));
    let active_lang = Arc::new(RwLock::new(settings.language.clone()));

    {
        let i18n_cb = i18n.clone();
        let active_lang_cb = active_lang.clone();
        app_window
            .global::<I18n>()
            .on_translate(move |key, fallback, _rev| {
                let lang = active_lang_cb.read().unwrap();
                i18n_cb
                    .translate(&lang, key.as_str(), fallback.as_str())
                    .into()
            });
    }

    let locale_options: Vec<LocaleOption> = i18n
        .locales
        .iter()
        .map(|l| LocaleOption {
            code: l.code.as_str().into(),
            name: l.name.as_str().into(),
            country_code: l.country_code.to_uppercase().into(),
        })
        .collect();
    app_window
        .global::<I18n>()
        .set_locales(ModelRc::new(VecModel::from(locale_options)));
    app_window
        .global::<I18n>()
        .set_current_code(settings.language.clone().into());
    if let Some(meta) = i18n.locales.iter().find(|l| l.code == settings.language) {
        app_window
            .global::<I18n>()
            .set_current_name(meta.name.clone().into());
    }

    // Populate initial settings & theme in UI
    app_window.set_setting_download_path(
        settings
            .download_path
            .to_string_lossy()
            .to_string()
            .into(),
    );
    app_window.set_setting_storage_mode(settings.storage_mode.to_index());
    app_window.set_setting_video_quality(settings.video_quality.clone().into());
    app_window.set_setting_max_concurrency(settings.max_concurrent_downloads as i32);
    app_window.set_setting_speed_limit_kb(settings.speed_limit_kb.unwrap_or(0) as i32);
    app_window.set_setting_skip_subtitles(settings.skip_subtitles);
    app_window.set_setting_skip_attachments(settings.skip_attachments);
    app_window.set_setting_auto_retry(settings.auto_retry);
    app_window.set_setting_schedule_enabled(settings.schedule_enabled);
    app_window.set_setting_schedule_start(settings.schedule_start.clone().into());
    app_window.set_setting_schedule_end(settings.schedule_end.clone().into());
    app_window.set_setting_close_to_tray(settings.close_to_tray);
    app_window.set_setting_vault_mode(settings.vault_mode);
    app_window.set_is_dark_mode(settings.dark_mode);
    app_window.set_theme_preset(settings.theme_preset as i32);

    // Populate stored profiles for the multi-account profile selector
    let initial_profiles = settings.profiles.clone();
    app_window.set_profiles(ModelRc::new(VecModel::from(to_profile_items(
        &initial_profiles,
    ))));
    app_window.set_is_adding_account(initial_profiles.is_empty());
    spawn_avatar_loader(app_window.as_weak(), initial_profiles);

    let state = Arc::new(TokioMutex::new(AppState {
        client: None,
        queue_manager: None,
        limiter: limiter.clone(),
        settings: settings.clone(),
        all_courses: Vec::new(),
    }));

    // Theme mode, color palette presets, and dynamic localization event handlers
    {
        let state = state.clone();
        let weak_window = app_window.as_weak();
        app_window.on_toggle_theme(move || {
            let state = state.clone();
            if let Some(ui) = weak_window.upgrade() {
                let new_mode = !ui.get_is_dark_mode();
                ui.set_is_dark_mode(new_mode);
                tokio::spawn(async move {
                    let mut s = state.lock().await;
                    s.settings.dark_mode = new_mode;
                    let _ = s.settings.save();
                });
            }
        });
    }
    {
        let state = state.clone();
        let weak_window = app_window.as_weak();
        app_window.on_select_theme_preset(move |preset_idx| {
            let state = state.clone();
            if let Some(ui) = weak_window.upgrade() {
                ui.set_theme_preset(preset_idx);
                tokio::spawn(async move {
                    let mut s = state.lock().await;
                    s.settings.theme_preset = preset_idx.max(0) as usize;
                    let _ = s.settings.save();
                });
            }
        });
    }
    {
        let state = state.clone();
        let i18n = i18n.clone();
        let active_lang = active_lang.clone();
        let weak_window = app_window.as_weak();
        app_window.on_select_language(move |lang_code| {
            let state = state.clone();
            let code_str = lang_code.to_string();
            *active_lang.write().unwrap() = code_str.clone();

            if let Some(ui) = weak_window.upgrade() {
                let i18n_global = ui.global::<I18n>();
                i18n_global.set_current_code(lang_code);
                if let Some(meta) = i18n.locales.iter().find(|l| l.code == code_str) {
                    i18n_global.set_current_name(meta.name.clone().into());
                }
                i18n_global.set_revision(i18n_global.get_revision() + 1);
                ui.set_show_language_menu(false);

                tokio::spawn(async move {
                    let mut s = state.lock().await;
                    s.settings.language = code_str;
                    let _ = s.settings.save();
                });
            }
        });
    }

    // Profile selection and authentication switch handler
    {
        let state = state.clone();
        let vault = vault.clone();
        let weak_window = app_window.as_weak();
        app_window.on_select_profile(move |profile_id| {
            let state = state.clone();
            let vault = vault.clone();
            let weak_window = weak_window.clone();
            let pid = profile_id.to_string();

            if let Some(ui) = weak_window.upgrade() {
                ui.set_is_logging_in(true);
                ui.set_login_status_message("Signing into profile...".into());
            }

            tokio::spawn(async move {
                let maybe_creds = {
                    let s = state.lock().await;
                    s.settings.decrypt_profile_token(&vault, &pid)
                };

                let Some((saved_prof, raw_token)) = maybe_creds else {
                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(ui) = weak_window.upgrade() {
                            ui.set_is_logging_in(false);
                            ui.set_login_status_message(
                                "Failed to decrypt saved profile token.".into(),
                            );
                        }
                    });
                    return;
                };

                match AuthService::validate_token(&raw_token, saved_prof.subdomain.clone()).await {
                    Ok((creds, live_profile)) => {
                        let client = Arc::new(UdemyClient::new(creds).unwrap());
                        let mut s = state.lock().await;
                        let limiter = s.limiter.clone();
                        let max_c = s.settings.max_concurrent_downloads;
                        let (qm, _) = DownloadQueueManager::new(client.clone(), limiter, max_c);

                        s.client = Some(client.clone());
                        s.queue_manager = Some(qm.clone());
                        s.settings.active_profile_id = Some(saved_prof.id.clone());
                        s.settings.subdomain = saved_prof.subdomain.clone();
                        let _ = s.settings.save();

                        let custom_prof_path = saved_prof
                            .custom_download_path
                            .as_ref()
                            .map(|p| p.to_string_lossy().to_string())
                            .unwrap_or_default();
                        let user_title = live_profile.title.unwrap_or(saved_prof.name);
                        let weak_inner = weak_window.clone();
                        let _ = slint::invoke_from_event_loop(move || {
                            if let Some(ui) = weak_inner.upgrade() {
                                ui.set_is_logging_in(false);
                                ui.set_is_logged_in(true);
                                ui.set_user_name(user_title.into());
                                ui.set_setting_profile_custom_path(custom_prof_path.into());
                                ui.set_login_status_message("".into());
                            }
                        });

                        spawn_queue_listener(weak_window.clone(), qm);

                        if let Ok(courses) = client.fetch_subscribed_courses().await {
                            let count = courses.len();
                            s.all_courses = courses.clone();
                            let weak_c = weak_window.clone();
                            let courses_for_ui = courses.clone();
                            let _ = slint::invoke_from_event_loop(move || {
                                if let Some(ui) = weak_c.upgrade() {
                                    ui.set_library_status(
                                        format!("Loaded {} courses", count).into(),
                                    );
                                    let course_items = to_course_items(&courses_for_ui);
                                    ui.set_courses(ModelRc::new(VecModel::from(course_items)));
                                }
                            });
                            spawn_thumbnail_loader(weak_window.clone(), courses);
                        }
                    }
                    Err(e) => {
                        let err_msg = format!("Session expired for {}: {}", saved_prof.name, e);
                        let _ = slint::invoke_from_event_loop(move || {
                            if let Some(ui) = weak_window.upgrade() {
                                ui.set_is_logging_in(false);
                                ui.set_login_status_message(err_msg.into());
                            }
                        });
                    }
                }
            });
        });
    }

    // Profile deletion handler
    {
        let state = state.clone();
        let weak_window = app_window.as_weak();
        app_window.on_delete_profile(move |profile_id| {
            let state = state.clone();
            let weak_window = weak_window.clone();
            let pid = profile_id.to_string();

            tokio::spawn(async move {
                let updated_profiles = {
                    let mut s = state.lock().await;
                    s.settings.remove_profile(&pid);
                    s.settings.profiles.clone()
                };
                let weak_ui = weak_window.clone();
                let profs_for_ui = updated_profiles.clone();
                let _ = slint::invoke_from_event_loop(move || {
                    if let Some(ui) = weak_ui.upgrade() {
                        ui.set_profiles(ModelRc::new(VecModel::from(to_profile_items(
                            &profs_for_ui,
                        ))));
                        if profs_for_ui.is_empty() {
                            ui.set_is_adding_account(true);
                            ui.set_is_managing_profiles(false);
                        }
                    }
                });
                spawn_avatar_loader(weak_window, updated_profiles);
            });
        });
    }

    // Browser-assisted authentication handler
    {
        let state = state.clone();
        let vault = vault.clone();
        let weak_window = app_window.as_weak();
        app_window.on_browser_login_requested(move |subdomain| {
            let state = state.clone();
            let vault = vault.clone();
            let weak_window = weak_window.clone();
            let sub_opt = if subdomain.trim().is_empty() {
                None
            } else {
                Some(subdomain.trim().to_string())
            };

            if let Some(ui) = weak_window.upgrade() {
                ui.set_is_auto_logging_in(true);
                ui.set_login_status_message("Waiting for sign-in in popup window...".into());
            }

            tokio::spawn(async move {
                match AuthService::spawn_login_popup(sub_opt.clone()).await {
                    Ok((extracted_token, profile)) => {
                        info!("Authenticated token received from login popup window!");
                        let creds = AuthCredentials::new(&extracted_token, sub_opt.clone());
                        let client = Arc::new(UdemyClient::new(creds.clone()).unwrap());

                        let chosen_name = profile.title.clone().unwrap_or_else(|| "Learner".into());

                        let mut s = state.lock().await;
                        if let Err(limit_err) = s.settings.upsert_profile(
                            &vault,
                            chosen_name.clone(),
                            sub_opt.clone(),
                            profile.image_50x50.clone(),
                            &creds.token,
                        ) {
                            let weak_err = weak_window.clone();
                            let _ = slint::invoke_from_event_loop(move || {
                                if let Some(ui) = weak_err.upgrade() {
                                    ui.set_is_auto_logging_in(false);
                                    ui.set_login_status_message(limit_err.into());
                                }
                            });
                            return;
                        }

                        let updated_profiles = s.settings.profiles.clone();
                        let limiter = s.limiter.clone();
                        let max_c = s.settings.max_concurrent_downloads;
                        let (qm, _) = DownloadQueueManager::new(client.clone(), limiter, max_c);

                        s.client = Some(client.clone());
                        s.queue_manager = Some(qm.clone());

                        let weak_inner = weak_window.clone();
                        let profs_ui = updated_profiles.clone();
                        let user_title = chosen_name.clone();
                        let _ = slint::invoke_from_event_loop(move || {
                            if let Some(ui) = weak_inner.upgrade() {
                                ui.set_profiles(ModelRc::new(VecModel::from(to_profile_items(
                                    &profs_ui,
                                ))));
                                ui.set_is_auto_logging_in(false);
                                ui.set_is_adding_account(false);
                                ui.set_is_logged_in(true);
                                ui.set_user_name(user_title.into());
                                ui.set_login_token("".into());
                                ui.set_login_status_message("".into());
                            }
                        });

                        spawn_avatar_loader(weak_window.clone(), updated_profiles);
                        spawn_queue_listener(weak_window.clone(), qm);

                        if let Ok(courses) = client.fetch_subscribed_courses().await {
                            let count = courses.len();
                            s.all_courses = courses.clone();
                            let weak_c = weak_window.clone();
                            let courses_for_ui = courses.clone();
                            let _ = slint::invoke_from_event_loop(move || {
                                if let Some(ui) = weak_c.upgrade() {
                                    ui.set_library_status(
                                        format!("Loaded {} courses", count).into(),
                                    );
                                    let course_items = to_course_items(&courses_for_ui);
                                    ui.set_courses(ModelRc::new(VecModel::from(course_items)));
                                }
                            });
                            spawn_thumbnail_loader(weak_window.clone(), courses);
                        }
                    }
                    Err(LoginError::Canceled) => {
                        let _ = slint::invoke_from_event_loop(move || {
                            if let Some(ui) = weak_window.upgrade() {
                                ui.set_is_auto_logging_in(false);
                                ui.set_login_status_message("Login window was closed.".into());
                            }
                        });
                    }
                    Err(e) => {
                        let err_msg = format!("Login error: {}", e);
                        let _ = slint::invoke_from_event_loop(move || {
                            if let Some(ui) = weak_window.upgrade() {
                                ui.set_is_auto_logging_in(false);
                                ui.set_login_status_message(err_msg.into());
                            }
                        });
                    }
                }
            });
        });
    }

    // Clipboard paste handler for manual access token input
    {
        let weak_window = app_window.as_weak();
        app_window.on_paste_token_requested(move || {
            if let Ok(mut clipboard) = arboard::Clipboard::new() {
                if let Ok(text) = clipboard.get_text() {
                    let clean = udeler_core::auth::sanitize_token(&text);
                    if !clean.is_empty() {
                        let weak = weak_window.clone();
                        let _ = slint::invoke_from_event_loop(move || {
                            if let Some(ui) = weak.upgrade() {
                                ui.set_login_token(clean.into());
                            }
                        });
                    }
                }
            }
        });
    }

    // Manual token authentication handler
    {
        let state = state.clone();
        let vault = vault.clone();
        let weak_window = app_window.as_weak();
        app_window.on_login_requested(move |token, subdomain| {
            let state = state.clone();
            let vault = vault.clone();
            let weak_window = weak_window.clone();
            let token_str = token.to_string();
            let sub_opt = if subdomain.trim().is_empty() {
                None
            } else {
                Some(subdomain.trim().to_string())
            };

            if let Some(ui) = weak_window.upgrade() {
                ui.set_is_logging_in(true);
                ui.set_login_status_message("Validating token with Udemy...".into());
            }

            tokio::spawn(async move {
                match AuthService::validate_token(&token_str, sub_opt.clone()).await {
                    Ok((creds, profile)) => {
                        let client = Arc::new(UdemyClient::new(creds.clone()).unwrap());
                        let chosen_name = profile.title.clone().unwrap_or_else(|| "Learner".into());

                        let mut s = state.lock().await;
                        if let Err(limit_err) = s.settings.upsert_profile(
                            &vault,
                            chosen_name.clone(),
                            sub_opt.clone(),
                            profile.image_50x50.clone(),
                            &creds.token,
                        ) {
                            let weak_err = weak_window.clone();
                            let _ = slint::invoke_from_event_loop(move || {
                                if let Some(ui) = weak_err.upgrade() {
                                    ui.set_is_logging_in(false);
                                    ui.set_login_status_message(limit_err.into());
                                }
                            });
                            return;
                        }

                        let updated_profiles = s.settings.profiles.clone();
                        let limiter = s.limiter.clone();
                        let max_c = s.settings.max_concurrent_downloads;
                        let (qm, _) = DownloadQueueManager::new(client.clone(), limiter, max_c);

                        s.client = Some(client.clone());
                        s.queue_manager = Some(qm.clone());

                        let weak_window_inner = weak_window.clone();
                        let profs_ui = updated_profiles.clone();
                        let user_title = chosen_name.clone();
                        let _ = slint::invoke_from_event_loop(move || {
                            if let Some(ui) = weak_window_inner.upgrade() {
                                ui.set_profiles(ModelRc::new(VecModel::from(to_profile_items(
                                    &profs_ui,
                                ))));
                                ui.set_is_logging_in(false);
                                ui.set_is_adding_account(false);
                                ui.set_is_logged_in(true);
                                ui.set_user_name(user_title.into());
                                ui.set_login_token("".into());
                                ui.set_login_status_message("".into());
                            }
                        });

                        spawn_avatar_loader(weak_window.clone(), updated_profiles);
                        spawn_queue_listener(weak_window.clone(), qm);

                        if let Ok(courses) = client.fetch_subscribed_courses().await {
                            let count = courses.len();
                            s.all_courses = courses.clone();
                            let weak_c = weak_window.clone();
                            let courses_for_ui = courses.clone();
                            let _ = slint::invoke_from_event_loop(move || {
                                if let Some(ui) = weak_c.upgrade() {
                                    ui.set_library_status(
                                        format!("Loaded {} courses", count).into(),
                                    );
                                    let course_items = to_course_items(&courses_for_ui);
                                    ui.set_courses(ModelRc::new(VecModel::from(course_items)));
                                }
                            });
                            spawn_thumbnail_loader(weak_window.clone(), courses);
                        }
                    }
                    Err(e) => {
                        let err_msg = format!("Token error: {}", e);
                        let _ = slint::invoke_from_event_loop(move || {
                            if let Some(ui) = weak_window.upgrade() {
                                ui.set_is_logging_in(false);
                                ui.set_login_status_message(err_msg.into());
                            }
                        });
                    }
                }
            });
        });
    }

    // Profile logout and switch handler
    {
        let state = state.clone();
        let weak_window = app_window.as_weak();
        app_window.on_logout_requested(move || {
            let state = state.clone();
            let weak_window = weak_window.clone();
            tokio::spawn(async move {
                let has_profiles = {
                    let mut s = state.lock().await;
                    s.client = None;
                    s.queue_manager = None;
                    s.all_courses.clear();
                    s.settings.active_profile_id = None;
                    let _ = s.settings.save();
                    !s.settings.profiles.is_empty()
                };

                let _ = slint::invoke_from_event_loop(move || {
                    if let Some(ui) = weak_window.upgrade() {
                        ui.set_is_logged_in(false);
                        ui.set_is_adding_account(!has_profiles);
                        ui.set_user_name("Guest".into());
                        ui.set_courses(ModelRc::new(VecModel::default()));
                        ui.set_login_status_message("".into());
                    }
                });
            });
        });
    }

    // Course catalog refresh handler
    {
        let state = state.clone();
        let weak_window = app_window.as_weak();
        app_window.on_refresh_courses(move || {
            let state = state.clone();
            let weak_window = weak_window.clone();
            if let Some(ui) = weak_window.upgrade() {
                ui.set_is_loading_courses(true);
                ui.set_library_status("Fetching enrolled and subscribed courses...".into());
            }

            tokio::spawn(async move {
                let client_opt = {
                    let s = state.lock().await;
                    s.client.clone()
                };
                if let Some(client) = client_opt {
                    match client.fetch_subscribed_courses().await {
                        Ok(courses) => {
                            let count = courses.len();
                            {
                                let mut s = state.lock().await;
                                s.all_courses = courses.clone();
                            }
                            let weak_inner = weak_window.clone();
                            let courses_for_ui = courses.clone();
                            let _ = slint::invoke_from_event_loop(move || {
                                if let Some(ui) = weak_inner.upgrade() {
                                    ui.set_is_loading_courses(false);
                                    ui.set_library_status(
                                        format!("Loaded {} courses", count).into(),
                                    );
                                    let course_items = to_course_items(&courses_for_ui);
                                    ui.set_courses(ModelRc::new(VecModel::from(course_items)));
                                }
                            });
                            spawn_thumbnail_loader(weak_window.clone(), courses);
                        }
                        Err(e) => {
                            let err_msg = e.to_string();
                            let _ = slint::invoke_from_event_loop(move || {
                                if let Some(ui) = weak_window.upgrade() {
                                    ui.set_is_loading_courses(false);
                                    ui.set_library_status(
                                        format!("Failed to load courses: {}", err_msg).into(),
                                    );
                                }
                            });
                        }
                    }
                }
            });
        });
    }

    // Real-time library search filter
    {
        let state = state.clone();
        let weak_window = app_window.as_weak();
        app_window.on_search_query_changed(move |query| {
            let q = query.trim().to_lowercase();
            let state = state.clone();
            let weak_window = weak_window.clone();
            tokio::spawn(async move {
                let all = state.lock().await.all_courses.clone();
                let filtered: Vec<UdemyCourse> = if q.is_empty() {
                    all
                } else {
                    all.into_iter()
                        .filter(|c| c.title.to_lowercase().contains(&q))
                        .collect()
                };
                let count = filtered.len();
                let weak_inner = weak_window.clone();
                let filtered_clone = filtered.clone();
                let _ = slint::invoke_from_event_loop(move || {
                    if let Some(ui) = weak_inner.upgrade() {
                        ui.set_library_status(format!("Showing {} courses", count).into());
                        let course_items = to_course_items(&filtered_clone);
                        ui.set_courses(ModelRc::new(VecModel::from(course_items)));
                    }
                });
                spawn_thumbnail_loader(weak_window, filtered);
            });
        });
    }

    // Course selection toggle handler
    {
        let weak_window = app_window.as_weak();
        app_window.on_toggle_course_selection(move |course_id| {
            if let Some(ui) = weak_window.upgrade() {
                let courses = ui.get_courses();
                let mut updated = Vec::new();
                for i in 0..courses.row_count() {
                    if let Some(mut c) = courses.row_data(i) {
                        if c.id == course_id {
                            c.selected = !c.selected;
                        }
                        updated.push(c);
                    }
                }
                ui.set_courses(ModelRc::new(VecModel::from(updated)));
            }
        });
    }

    // Bulk course selection handler
    {
        let weak_window = app_window.as_weak();
        app_window.on_select_all_courses(move |select| {
            if let Some(ui) = weak_window.upgrade() {
                let courses = ui.get_courses();
                let mut updated = Vec::new();
                for i in 0..courses.row_count() {
                    if let Some(mut c) = courses.row_data(i) {
                        c.selected = select;
                        updated.push(c);
                    }
                }
                ui.set_courses(ModelRc::new(VecModel::from(updated)));
            }
        });
    }

    // Bulk course download dispatch handler
    {
        let state = state.clone();
        let weak_window = app_window.as_weak();
        app_window.on_download_selected_courses(move || {
            let state = state.clone();
            let weak_window = weak_window.clone();
            tokio::spawn(async move {
                let (client_opt, qm_opt, settings, selected_ids) = {
                    let s = state.lock().await;
                    let ids: Vec<u64> = if let Some(ui) = weak_window.upgrade() {
                        let courses = ui.get_courses();
                        let mut selected = Vec::new();
                        for i in 0..courses.row_count() {
                            if let Some(c) = courses.row_data(i) {
                                if c.selected {
                                    selected.push(c.id as u64);
                                }
                            }
                        }
                        selected
                    } else {
                        Vec::new()
                    };
                    (
                        s.client.clone(),
                        s.queue_manager.clone(),
                        s.settings.clone(),
                        ids,
                    )
                };

                if let (Some(client), Some(qm)) = (client_opt, qm_opt) {
                    for course_id in selected_ids {
                        queue_course_downloads(&client, &qm, &settings, course_id).await;
                    }
                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(ui) = weak_window.upgrade() {
                            ui.set_active_tab(1);
                        }
                    });
                }
            });
        });
    }

    // Individual course download dispatch handler
    {
        let state = state.clone();
        let weak_window = app_window.as_weak();
        app_window.on_download_single_course(move |course_id| {
            let state = state.clone();
            let weak_window = weak_window.clone();
            tokio::spawn(async move {
                let (client_opt, qm_opt, settings) = {
                    let s = state.lock().await;
                    (
                        s.client.clone(),
                        s.queue_manager.clone(),
                        s.settings.clone(),
                    )
                };
                if let (Some(client), Some(qm)) = (client_opt, qm_opt) {
                    queue_course_downloads(&client, &qm, &settings, course_id as u64).await;
                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(ui) = weak_window.upgrade() {
                            ui.set_active_tab(1);
                        }
                    });
                }
            });
        });
    }

    // Course curriculum modal dialog handlers
    {
        let state = state.clone();
        let weak_window = app_window.as_weak();
        app_window.on_open_course_content(move |course_id| {
            let state = state.clone();
            let weak_window = weak_window.clone();

            if let Some(ui) = weak_window.upgrade() {
                ui.set_curriculum_course_id(course_id);
                ui.set_show_curriculum_modal(true);
                ui.set_is_loading_curriculum(true);
                ui.set_curriculum_items(ModelRc::new(VecModel::default()));

                let courses = ui.get_courses();
                for i in 0..courses.row_count() {
                    if let Some(c) = courses.row_data(i) {
                        if c.id == course_id {
                            ui.set_curriculum_course_title(c.title);
                            if c.thumb.size().width > 0 {
                                ui.set_curriculum_course_thumb(c.thumb);
                            }
                            break;
                        }
                    }
                }
            }

            tokio::spawn(async move {
                let client_opt = {
                    let s = state.lock().await;
                    s.client.clone()
                };
                if let Some(client) = client_opt {
                    if let Ok(curriculum) = client.fetch_course_curriculum(course_id as u64).await {
                        let lectures: Vec<CurriculumLecture> = curriculum
                            .into_iter()
                            .filter(|item| item._class != "chapter")
                            .map(|item| {
                                let item_type = item._class;
                                let asset_type = item
                                    .asset
                                    .as_ref()
                                    .and_then(|a| a.asset_type.clone())
                                    .unwrap_or_else(|| "Video".into());
                                let duration_text = item
                                    .asset
                                    .as_ref()
                                    .and_then(|a| a.time_estimation)
                                    .map(|secs| format!("{}m", (secs + 59) / 60))
                                    .unwrap_or_default();

                                CurriculumLecture {
                                    id: item.id as i32,
                                    index: item.object_index.unwrap_or(0) as i32,
                                    title: item.title.into(),
                                    item_type: item_type.into(),
                                    asset_type: asset_type.into(),
                                    duration_text: duration_text.into(),
                                }
                            })
                            .collect();

                        let weak_inner = weak_window.clone();
                        let _ = slint::invoke_from_event_loop(move || {
                            if let Some(ui) = weak_inner.upgrade() {
                                ui.set_curriculum_items(ModelRc::new(VecModel::from(lectures)));
                                ui.set_is_loading_curriculum(false);
                            }
                        });
                    } else {
                        let weak_inner = weak_window.clone();
                        let _ = slint::invoke_from_event_loop(move || {
                            if let Some(ui) = weak_inner.upgrade() {
                                ui.set_is_loading_curriculum(false);
                            }
                        });
                    }
                }
            });
        });
    }

    {
        let weak_window = app_window.as_weak();
        app_window.on_close_course_content(move || {
            if let Some(ui) = weak_window.upgrade() {
                ui.set_show_curriculum_modal(false);
            }
        });
    }

    {
        let state = state.clone();
        let weak_window = app_window.as_weak();
        app_window.on_download_entire_course(move |course_id| {
            let state = state.clone();
            let weak_window = weak_window.clone();
            tokio::spawn(async move {
                let (client_opt, qm_opt, settings) = {
                    let s = state.lock().await;
                    (
                        s.client.clone(),
                        s.queue_manager.clone(),
                        s.settings.clone(),
                    )
                };
                if let (Some(client), Some(qm)) = (client_opt, qm_opt) {
                    queue_course_downloads(&client, &qm, &settings, course_id as u64).await;
                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(ui) = weak_window.upgrade() {
                            ui.set_show_curriculum_modal(false);
                            ui.set_active_tab(1);
                        }
                    });
                }
            });
        });
    }

    {
        let state = state.clone();
        app_window.on_download_lecture_item(move |course_id, lecture_id| {
            let state = state.clone();
            tokio::spawn(async move {
                let (client_opt, qm_opt, settings) = {
                    let s = state.lock().await;
                    (
                        s.client.clone(),
                        s.queue_manager.clone(),
                        s.settings.clone(),
                    )
                };
                if let (Some(client), Some(qm)) = (client_opt, qm_opt) {
                    queue_single_lecture_download(
                        &client,
                        &qm,
                        &settings,
                        course_id as u64,
                        lecture_id as u64,
                    )
                    .await;
                }
            });
        });
    }

    // Download pause and resume handlers
    {
        let state = state.clone();
        app_window.on_pause_all_downloads(move || {
            let state = state.clone();
            tokio::spawn(async move {
                if let Some(qm) = state.lock().await.queue_manager.clone() {
                    qm.pause_all().await;
                }
            });
        });
    }
    {
        let state = state.clone();
        app_window.on_resume_all_downloads(move || {
            let state = state.clone();
            tokio::spawn(async move {
                if let Some(qm) = state.lock().await.queue_manager.clone() {
                    qm.resume_all().await;
                }
            });
        });
    }

    // Download cancellation handler
    {
        let state = state.clone();
        app_window.on_cancel_download(move |lecture_id| {
            let state = state.clone();
            tokio::spawn(async move {
                if let Some(qm) = state.lock().await.queue_manager.clone() {
                    qm.cancel_item(lecture_id as u64).await;
                }
            });
        });
    }

    // File dialog directory selection handlers
    {
        let weak_window = app_window.as_weak();
        app_window.on_browse_download_path(move || {
            let weak_window = weak_window.clone();
            tokio::spawn(async move {
                if let Some(folder) = rfd::AsyncFileDialog::new().pick_folder().await {
                    let path_str = folder.path().to_string_lossy().to_string();
                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(ui) = weak_window.upgrade() {
                            ui.set_setting_download_path(path_str.into());
                            ui.set_has_unsaved_settings(true);
                        }
                    });
                }
            });
        });
    }
    {
        let weak_window = app_window.as_weak();
        app_window.on_browse_profile_custom_path(move || {
            let weak_window = weak_window.clone();
            tokio::spawn(async move {
                if let Some(folder) = rfd::AsyncFileDialog::new().pick_folder().await {
                    let path_str = folder.path().to_string_lossy().to_string();
                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(ui) = weak_window.upgrade() {
                            ui.set_setting_profile_custom_path(path_str.into());
                            ui.set_has_unsaved_settings(true);
                        }
                    });
                }
            });
        });
    }

    // Settings persistence handler
    {
        let state = state.clone();
        let weak_window = app_window.as_weak();
        app_window.on_save_settings(move || {
            let state = state.clone();
            let weak_window = weak_window.clone();

            if let Some(ui) = weak_window.upgrade() {
                let download_path = PathBuf::from(ui.get_setting_download_path().as_str());
                let storage_mode = DownloadStorageMode::from_index(ui.get_setting_storage_mode());
                let prof_custom_str = ui.get_setting_profile_custom_path().trim().to_string();
                let prof_custom_path = if prof_custom_str.is_empty() {
                    None
                } else {
                    Some(PathBuf::from(prof_custom_str))
                };
                let video_quality = ui.get_setting_video_quality().to_string();
                let max_concurrency = ui.get_setting_max_concurrency().max(1) as usize;
                let speed_limit = ui.get_setting_speed_limit_kb();
                let speed_limit_kb = if speed_limit > 0 {
                    Some(speed_limit as u64)
                } else {
                    None
                };
                let skip_subs = ui.get_setting_skip_subtitles();
                let skip_attach = ui.get_setting_skip_attachments();
                let auto_retry = ui.get_setting_auto_retry();
                let sched_en = ui.get_setting_schedule_enabled();
                let sched_start = ui.get_setting_schedule_start().to_string();
                let sched_end = ui.get_setting_schedule_end().to_string();
                let close_tray = ui.get_setting_close_to_tray();
                let vault_mode = ui.get_setting_vault_mode();

                tokio::spawn(async move {
                    let mut s = state.lock().await;
                    s.settings.download_path = download_path;
                    s.settings.storage_mode = storage_mode;
                    s.settings.set_active_profile_custom_path(prof_custom_path);
                    s.settings.video_quality = video_quality;
                    s.settings.max_concurrent_downloads = max_concurrency;
                    s.settings.speed_limit_kb = speed_limit_kb;
                    s.settings.skip_subtitles = skip_subs;
                    s.settings.skip_attachments = skip_attach;
                    s.settings.auto_retry = auto_retry;
                    s.settings.schedule_enabled = sched_en;
                    s.settings.schedule_start = sched_start;
                    s.settings.schedule_end = sched_end;
                    s.settings.close_to_tray = close_tray;
                    s.settings.vault_mode = vault_mode;
                    s.limiter.set_limit_kb(speed_limit_kb);
                    if let Some(qm) = &s.queue_manager {
                        qm.set_concurrency(max_concurrency).await;
                    }
                    let _ = s.settings.save();

                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(ui) = weak_window.upgrade() {
                            ui.set_has_unsaved_settings(false);
                            ui.set_settings_save_status("Settings Saved Successfully!".into());
                        }
                    });
                });
            }
        });
    }

    // Unsaved settings navigation guard handler
    {
        let weak_window = app_window.as_weak();
        app_window.on_confirm_discard_settings(move || {
            if let Some(ui) = weak_window.upgrade() {
                ui.set_show_unsaved_dialog(false);
                ui.set_has_unsaved_settings(false);
                ui.set_active_tab(ui.get_pending_tab_switch());
            }
        });
    }
    {
        let weak_window = app_window.as_weak();
        app_window.on_cancel_discard_settings(move || {
            if let Some(ui) = weak_window.upgrade() {
                ui.set_show_unsaved_dialog(false);
            }
        });
    }

    // External hyperlink dispatch handler
    {
        app_window.on_open_external_url(move |url| {
            let url_str = url.to_string();
            let _ = open::that(&url_str);
        });
    }

    // Release update check handler
    {
        let weak_window = app_window.as_weak();
        app_window.on_check_for_updates(move || {
            let weak_window = weak_window.clone();
            if let Some(ui) = weak_window.upgrade() {
                ui.set_is_checking_updates(true);
                ui.set_update_status_text("Checking GitHub for updates...".into());
            }

            tokio::spawn(async move {
                let client = reqwest::Client::builder()
                    .user_agent("Udeler-Reborn")
                    .timeout(std::time::Duration::from_secs(8))
                    .build()
                    .unwrap_or_default();

                let res = client
                    .get("https://api.github.com/repos/M3rcena/Udeler-Reborn/releases/latest")
                    .send()
                    .await;

                let (status_text, is_available, release_url) = match res {
                    Ok(resp) => {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            let tag = json.get("tag_name").and_then(|v| v.as_str()).unwrap_or("");
                            let html_url =
                                json.get("html_url").and_then(|v| v.as_str()).unwrap_or("");
                            let current = "v4.0.0";
                            if !tag.is_empty() && tag != current {
                                (
                                    format!("Udeler Reborn {} is available!", tag),
                                    true,
                                    html_url.to_string(),
                                )
                            } else {
                                (
                                    format!(
                                        "Udeler Reborn {} is the latest version available.",
                                        current
                                    ),
                                    false,
                                    html_url.to_string(),
                                )
                            }
                        } else {
                            (
                                "Could not parse release information.".to_string(),
                                false,
                                String::new(),
                            )
                        }
                    }
                    Err(e) => (format!("Update check failed: {}", e), false, String::new()),
                };

                let _ = slint::invoke_from_event_loop(move || {
                    if let Some(ui) = weak_window.upgrade() {
                        ui.set_is_checking_updates(false);
                        ui.set_update_status_text(status_text.into());
                        ui.set_update_available(is_available);
                        ui.set_update_release_url(release_url.into());
                    }
                });
            });
        });
    }

    app_window.run()?;
    Ok(())
}

fn spawn_queue_listener(weak_window: slint::Weak<MainWindow>, qm: DownloadQueueManager) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            let snapshots = qm.get_snapshots().await;

            let active_count = snapshots
                .iter()
                .filter(|s| s.status == QueueStatus::Downloading)
                .count() as i32;

            let rows: Vec<DownloadRow> = snapshots
                .into_iter()
                .map(|s| {
                    let progress = if let Some(tot) = s.total_bytes {
                        if tot > 0 {
                            (s.downloaded_bytes as f32) / (tot as f32)
                        } else {
                            0.0
                        }
                    } else {
                        0.0
                    };

                    let progress_text = if let Some(tot) = s.total_bytes {
                        format!(
                            "{:.1} MB / {:.1} MB ({:.0}%)",
                            (s.downloaded_bytes as f64) / 1_048_576.0,
                            (tot as f64) / 1_048_576.0,
                            progress * 100.0
                        )
                    } else {
                        format!("{:.1} MB", (s.downloaded_bytes as f64) / 1_048_576.0)
                    };

                    let speed_text = if s.speed_bps >= 1_048_576.0 {
                        format!("{:.1} MB/s", s.speed_bps / 1_048_576.0)
                    } else {
                        format!("{:.0} KB/s", s.speed_bps / 1024.0)
                    };

                    let eta_text = match s.eta_secs {
                        Some(secs) if secs >= 60 => format!("{}m {}s", secs / 60, secs % 60),
                        Some(secs) => format!("{}s", secs),
                        None => "--".to_string(),
                    };

                    let (status_text, is_active) = match s.status {
                        QueueStatus::Pending => ("Pending", true),
                        QueueStatus::Downloading => ("Downloading", true),
                        QueueStatus::Completed => ("Completed", false),
                        QueueStatus::Failed(_) => ("Failed", false),
                        QueueStatus::Canceled => ("Canceled", false),
                        QueueStatus::Paused => ("Paused", true),
                    };

                    DownloadRow {
                        lecture_id: s.lecture_id as i32,
                        course_title: s.course_title.into(),
                        lecture_title: s.lecture_title.into(),
                        status_text: status_text.into(),
                        progress,
                        progress_text: progress_text.into(),
                        speed_text: speed_text.into(),
                        eta_text: eta_text.into(),
                        is_active,
                    }
                })
                .collect();

            let weak = weak_window.clone();
            let _ = slint::invoke_from_event_loop(move || {
                if let Some(ui) = weak.upgrade() {
                    ui.set_active_downloads_count(active_count);
                    ui.set_downloads(ModelRc::new(VecModel::from(rows)));
                }
            });
        }
    });
}

async fn queue_course_downloads(
    client: &UdemyClient,
    qm: &DownloadQueueManager,
    settings: &AppSettings,
    course_id: u64,
) {
    if let Ok(curriculum) = client.fetch_course_curriculum(course_id).await {
        let mut chapter_title = "Introduction".to_string();
        let mut requests = Vec::new();
        let effective_path = settings.resolve_effective_download_path();

        for item in curriculum {
            if item._class == "chapter" {
                chapter_title = item.title;
            } else if item._class == "lecture"
                || item._class == "quiz"
                || item._class == "practice"
            {
                let req = DownloadItemRequest {
                    course_id,
                    course_title: format!("Course_{}", course_id),
                    chapter_title: chapter_title.clone(),
                    lecture_id: item.id,
                    lecture_title: item.title,
                    lecture_index: item.object_index.unwrap_or(0) as u32,
                    time_estimation: item.asset.as_ref().and_then(|a| a.time_estimation),
                    item_type: if item._class == "quiz" {
                        "Quiz".into()
                    } else if item.asset.as_ref().and_then(|a| a.asset_type.as_deref())
                        == Some("Article")
                    {
                        "Article".into()
                    } else {
                        "Video".into()
                    },
                    download_path: effective_path.clone(),
                    video_quality: settings.video_quality.clone(),
                    skip_subtitles: settings.skip_subtitles,
                    skip_attachments: settings.skip_attachments,
                    auto_retry: settings.auto_retry,
                };
                requests.push(req);
            }
        }

        qm.add_items(requests).await;
    }
}

async fn queue_single_lecture_download(
    client: &UdemyClient,
    qm: &DownloadQueueManager,
    settings: &AppSettings,
    course_id: u64,
    lecture_id: u64,
) {
    if let Ok(curriculum) = client.fetch_course_curriculum(course_id).await {
        let mut chapter_title = "Introduction".to_string();
        let effective_path = settings.resolve_effective_download_path();

        for item in curriculum {
            if item._class == "chapter" {
                chapter_title = item.title;
            } else if item.id == lecture_id {
                let req = DownloadItemRequest {
                    course_id,
                    course_title: format!("Course_{}", course_id),
                    chapter_title: chapter_title.clone(),
                    lecture_id: item.id,
                    lecture_title: item.title,
                    lecture_index: item.object_index.unwrap_or(0) as u32,
                    time_estimation: item.asset.as_ref().and_then(|a| a.time_estimation),
                    item_type: if item._class == "quiz" {
                        "Quiz".into()
                    } else if item.asset.as_ref().and_then(|a| a.asset_type.as_deref())
                        == Some("Article")
                    {
                        "Article".into()
                    } else {
                        "Video".into()
                    },
                    download_path: effective_path,
                    video_quality: settings.video_quality.clone(),
                    skip_subtitles: settings.skip_subtitles,
                    skip_attachments: settings.skip_attachments,
                    auto_retry: settings.auto_retry,
                };
                qm.add_items(vec![req]).await;
                break;
            }
        }
    }
}