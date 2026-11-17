use crate::auth::AuthCredentials;
use crate::models::{
    CurriculumItem, LectureDetailResponse, PaginatedResponse, RawCourseWrapper, UdemyCourse,
    UserProfile,
};
use reqwest::header::HeaderMap;
use std::collections::HashMap;
use std::time::Duration;
use thiserror::Error;
use tracing::{debug, warn};
use url::Url;

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("HTTP error status: {0}")]
    HttpStatus(u16),
    #[error("Authentication failed or token expired (HTTP 401)")]
    Unauthorized,
    #[error("JSON parsing error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Invalid URL: {0}")]
    Url(#[from] url::ParseError),
    #[error("API request failed: {0}")]
    Other(String),
}

pub struct UdemyClient {
    client: reqwest::Client,
    creds: AuthCredentials,
    headers: HeaderMap,
}

impl UdemyClient {
    pub fn new(creds: AuthCredentials) -> Result<Self, ApiError> {
        let headers = creds
            .build_headers()
            .map_err(|e| ApiError::Other(format!("Invalid header values: {}", e)))?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(45))
            .cookie_store(true)
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()?;

        Ok(Self {
            client,
            creds,
            headers,
        })
    }

    pub fn credentials(&self) -> &AuthCredentials {
        &self.creds
    }

    /// Validates the authentication token and retrieves user profile details.
    pub async fn verify_token(&self) -> Result<UserProfile, ApiError> {
        let base_url = self.creds.base_url();

        // 1. Try /api-2.0/users/me/ to get the user's actual name and avatar
        let user_url = format!(
            "{}/api-2.0/users/me/?fields[user]=@min,title,display_name,name,image_50x50,image_100x100",
            base_url
        );
        let mut resolved_profile: Option<UserProfile> = None;

        if let Ok(res) = self
            .client
            .get(&user_url)
            .headers(self.headers.clone())
            .send()
            .await
        {
            if res.status().is_success() {
                if let Ok(val) = res.json::<serde_json::Value>().await {
                    let id = val.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
                    let title = val
                        .get("title")
                        .or_else(|| val.get("display_name"))
                        .or_else(|| val.get("name"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty());
                    let avatar = val
                        .get("image_100x100")
                        .or_else(|| val.get("image_50x50"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty());

                    if id > 0 || title.is_some() {
                        resolved_profile = Some(UserProfile {
                            id,
                            title,
                            image_50x50: avatar,
                        });
                    }
                }
            }
        }

        // 2. Validate against subscribed-courses
        let standard_url = format!(
            "{}/api-2.0/users/me/subscribed-courses/?fields[course]=@min,title,published_title,url,image_480x270,is_practice_test_course&page_size=1&ordering=-last_accessed",
            base_url
        );

        let res = self
            .client
            .get(&standard_url)
            .headers(self.headers.clone())
            .send()
            .await?;

        if res.status().is_success() {
            return Ok(resolved_profile.unwrap_or(UserProfile {
                id: 0,
                title: Some("Udemy Learner".to_string()),
                image_50x50: None,
            }));
        }

        // 3. Fallback: Check subscription-course-enrollments
        let enrolled_url = format!(
            "{}/api-2.0/users/me/subscription-course-enrollments/?page_size=1",
            base_url
        );
        if let Ok(enr_res) = self
            .client
            .get(&enrolled_url)
            .headers(self.headers.clone())
            .send()
            .await
        {
            if enr_res.status().is_success() {
                return Ok(resolved_profile.unwrap_or(UserProfile {
                    id: 0,
                    title: Some("Udemy Business".to_string()),
                    image_50x50: None,
                }));
            }
        }

        if let Some(profile) = resolved_profile {
            return Ok(profile);
        }

        if res.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ApiError::Unauthorized);
        }
        if res.status() == reqwest::StatusCode::FORBIDDEN {
            let body = res.text().await.unwrap_or_default();
            warn!(
                "Udemy returned 403 Forbidden: {}",
                &body[..body.len().min(250)]
            );
            return Err(ApiError::Other("HTTP 403 Forbidden".into()));
        }
        Err(ApiError::HttpStatus(res.status().as_u16()))
    }

    /// Fetches all subscribed, enrolled, and archived courses concurrently
    pub async fn fetch_subscribed_courses(&self) -> Result<Vec<UdemyCourse>, ApiError> {
        let base_url = self.creds.base_url();
        let standard_url = format!(
            "{}/api-2.0/users/me/subscribed-courses/?fields[course]=@min,title,published_title,url,image_480x270,is_practice_test_course&page_size=100&ordering=-last_accessed",
            base_url
        );
        let enrolled_url = format!(
            "{}/api-2.0/users/me/subscription-course-enrollments/?page_size=100",
            base_url
        );
        let archived_url = format!(
            "{}/api-2.0/users/me/subscribed-courses/?is_archived=true&fields[course]=@min,title,published_title,url,image_480x270&page_size=100",
            base_url
        );

        let (std_res, enr_res, arc_res) = tokio::join!(
            self.fetch_all_course_pages(&standard_url),
            self.fetch_all_course_pages(&enrolled_url),
            self.fetch_all_course_pages(&archived_url)
        );

        let mut all_courses: HashMap<u64, UdemyCourse> = HashMap::new();
        if let Ok(courses) = std_res {
            for c in courses {
                all_courses.insert(c.id, c);
            }
        }
        if let Ok(courses) = enr_res {
            for c in courses {
                all_courses.entry(c.id).or_insert(c);
            }
        }
        if let Ok(courses) = arc_res {
            for c in courses {
                all_courses.entry(c.id).or_insert(c);
            }
        }

        let mut result: Vec<UdemyCourse> = all_courses.into_values().collect();
        result.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
        Ok(result)
    }

    async fn fetch_all_course_pages(&self, start_url: &str) -> Result<Vec<UdemyCourse>, ApiError> {
        let mut courses = Vec::new();
        let mut next_url: Option<String> = Some(start_url.to_string());
        let base_url = Url::parse(&self.creds.base_url())?;

        while let Some(current_url) = next_url {
            debug!("Fetching course page: {}", current_url);
            let res = self
                .client
                .get(&current_url)
                .headers(self.headers.clone())
                .send()
                .await?;

            if !res.status().is_success() {
                warn!("Course request returned status: {}", res.status());
                break;
            }

            let text = res.text().await?;
            let page: PaginatedResponse<RawCourseWrapper> = match serde_json::from_str(&text) {
                Ok(p) => p,
                Err(e) => {
                    warn!("Failed to parse course page JSON: {}", e);
                    break;
                }
            };

            for wrapper in page.results {
                courses.push(wrapper.0);
            }

            next_url = page.next.and_then(|nxt| {
                if nxt.trim().is_empty() {
                    None
                } else {
                    base_url.join(&nxt).ok().map(|u| u.to_string())
                }
            });
        }

        Ok(courses)
    }

    /// Fetches all curriculum items (chapters, lectures, quizzes) for a given course
    pub async fn fetch_course_curriculum(
        &self,
        course_id: u64,
    ) -> Result<Vec<CurriculumItem>, ApiError> {
        let base_url_str = self.creds.base_url();
        let base_url = Url::parse(&base_url_str)?;

        let mut api_url: Option<String> = Some(format!(
            "{}/api-2.0/courses/{}/subscriber-curriculum-items/?curriculum_types=chapter,lecture,practice,quiz,role-play&page_size=200&fields[lecture]=title,object_index,is_published,sort_order,created,asset,supplementary_assets,is_free&fields[quiz]=title,object_index,is_published,sort_order,type&fields[practice]=title,object_index,is_published,sort_order&fields[chapter]=title,object_index,is_published,sort_order&fields[asset]=title,filename,asset_type,status,time_estimation,is_external,course_is_drmed,media_sources,download_urls",
            base_url_str, course_id
        ));

        let mut items = Vec::new();
        while let Some(current_url) = api_url {
            let res = self
                .client
                .get(&current_url)
                .headers(self.headers.clone())
                .send()
                .await?;

            if !res.status().is_success() {
                return Err(ApiError::HttpStatus(res.status().as_u16()));
            }

            let text = res.text().await?;
            let page: PaginatedResponse<CurriculumItem> = serde_json::from_str(&text)?;
            items.extend(page.results);

            api_url = page.next.and_then(|nxt| {
                if nxt.trim().is_empty() {
                    None
                } else {
                    base_url.join(&nxt).ok().map(|u| u.to_string())
                }
            });
        }

        items.sort_by_key(|item| item.sort_order);
        Ok(items)
    }

    /// Resolves lecture media assets using fallback endpoints across multiple API tiers.
    pub async fn fetch_lecture_details(
        &self,
        course_id: u64,
        lecture_id: u64,
    ) -> Result<LectureDetailResponse, ApiError> {
        let base_url = self.creds.base_url();
        let primary_url = format!(
            "{}/api-2.0/users/me/subscribed-courses/{}/lectures/{}/?fields[lecture]=asset,supplementary_assets&fields[asset]=@min,download_urls,stream_urls,media_sources,external_url,body,filename,captions",
            base_url, course_id, lecture_id
        );
        let fallback_url = format!(
            "{}/api-2.0/courses/{}/lectures/{}/?fields[lecture]=asset,supplementary_assets&fields[asset]=@min,download_urls,stream_urls,media_sources,external_url,body,filename,captions",
            base_url, course_id, lecture_id
        );

        // 1. Try primary endpoint
        if let Ok(res) = self
            .client
            .get(&primary_url)
            .headers(self.headers.clone())
            .send()
            .await
        {
            if res.status().is_success() {
                if let Ok(details) = res.json::<LectureDetailResponse>().await {
                    if details.asset.is_some() {
                        return Ok(details);
                    }
                }
            } else if res.status() == reqwest::StatusCode::FORBIDDEN
                || res.status() == reqwest::StatusCode::NOT_FOUND
            {
                // 2. Try secondary course endpoint
                if let Ok(fb_res) = self
                    .client
                    .get(&fallback_url)
                    .headers(self.headers.clone())
                    .send()
                    .await
                {
                    if fb_res.status().is_success() {
                        if let Ok(details) = fb_res.json::<LectureDetailResponse>().await {
                            if details.asset.is_some() {
                                return Ok(details);
                            }
                        }
                    }
                }
            }
        }

        // 3. Fallback to subscriber-curriculum-items query
        let curriculum_search_url = format!(
            "{}/api-2.0/courses/{}/subscriber-curriculum-items/?curriculum_types=lecture&page_size=200&fields[lecture]=title,object_index,asset,supplementary_assets&fields[asset]=@min,download_urls,stream_urls,media_sources,external_url,body,filename,captions",
            base_url, course_id
        );
        let mut next_search: Option<String> = Some(curriculum_search_url);
        let parsed_base = Url::parse(&base_url)?;

        while let Some(search_url) = next_search {
            if let Ok(search_res) = self
                .client
                .get(&search_url)
                .headers(self.headers.clone())
                .send()
                .await
            {
                if search_res.status().is_success() {
                    if let Ok(raw_val) = search_res.json::<serde_json::Value>().await {
                        if let Some(results) = raw_val.get("results").and_then(|r| r.as_array()) {
                            for item in results {
                                if item.get("id").and_then(|id| id.as_u64()) == Some(lecture_id) {
                                    let asset: Option<crate::models::LectureAsset> = item
                                        .get("asset")
                                        .and_then(|a| serde_json::from_value(a.clone()).ok());
                                    let supplementary: Option<
                                        Vec<crate::models::SupplementaryAsset>,
                                    > = item
                                        .get("supplementary_assets")
                                        .and_then(|s| serde_json::from_value(s.clone()).ok());
                                    if asset.is_some() {
                                        return Ok(LectureDetailResponse {
                                            asset,
                                            supplementary_assets: supplementary,
                                        });
                                    }
                                }
                            }
                        }
                        next_search = raw_val
                            .get("next")
                            .and_then(|n| n.as_str())
                            .filter(|n| !n.trim().is_empty())
                            .and_then(|n| parsed_base.join(n).ok().map(|u| u.to_string()));
                        continue;
                    }
                }
            }
            break;
        }

        Err(ApiError::Other(format!(
            "Failed to retrieve assets for lecture {}",
            lecture_id
        )))
    }
}