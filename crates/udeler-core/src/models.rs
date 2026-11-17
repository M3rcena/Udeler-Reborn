use serde::{Deserialize, Deserializer, Serialize};

/// Normalized representation of a Udemy course.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct UdemyCourse {
    pub id: u64,
    pub title: String,
    pub url: String,
    pub image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawCourseItem {
    #[serde(default)]
    id: Option<u64>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    published_title: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    image_480x270: Option<String>,
    #[serde(default)]
    image_240x135: Option<String>,
    #[serde(default)]
    image_125_h: Option<String>,
    #[serde(default)]
    course: Option<Box<RawInnerCourse>>,
}

#[derive(Debug, Deserialize)]
struct RawInnerCourse {
    #[serde(default)]
    id: Option<u64>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    published_title: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    image_480x270: Option<String>,
    #[serde(default)]
    image_240x135: Option<String>,
    #[serde(default)]
    image_125_h: Option<String>,
}

impl<'de> Deserialize<'de> for RawCourseWrapper {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = RawCourseItem::deserialize(deserializer)?;
        let inner = raw.course.as_deref();

        let id = inner
            .and_then(|c| c.id)
            .or(raw.id)
            .unwrap_or(0);

        let title = inner
            .and_then(|c| c.title.as_ref().or(c.published_title.as_ref()))
            .or(raw.title.as_ref().or(raw.published_title.as_ref()))
            .cloned()
            .unwrap_or_else(|| format!("Course {}", id));

        let mut url = inner
            .and_then(|c| c.url.clone())
            .or(raw.url)
            .unwrap_or_else(|| format!("/course/{}/", id));

        if !url.starts_with("http") && !url.starts_with('/') {
            url = format!("/{}", url);
        }

        let image_url = inner
            .and_then(|c| {
                c.image_480x270
                    .clone()
                    .or_else(|| c.image_240x135.clone())
                    .or_else(|| c.image_125_h.clone())
            })
            .or(raw.image_480x270)
            .or(raw.image_240x135)
            .or(raw.image_125_h);

        Ok(RawCourseWrapper(UdemyCourse {
            id,
            title,
            url,
            image_url,
        }))
    }
}

#[derive(Debug, Clone, Default)]
pub struct RawCourseWrapper(pub UdemyCourse);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub count: Option<u64>,
    pub next: Option<String>,
    pub previous: Option<String>,
    #[serde(default = "Vec::new")]
    pub results: Vec<T>,
}

/// Represents a curriculum component (chapter, lecture, quiz, or practice activity).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CurriculumItem {
    pub _class: String,
    pub id: u64,
    #[serde(default = "default_title")]
    pub title: String,
    pub object_index: Option<i64>,
    #[serde(default)]
    pub sort_order: i64,
    pub is_free: Option<bool>,
    pub asset: Option<AssetSummary>,
}

fn default_title() -> String {
    "Untitled".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetSummary {
    pub asset_type: Option<String>,
    pub time_estimation: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadUrl {
    pub file: Option<String>,
    pub src: Option<String>,
    pub label: Option<String>,
    #[serde(rename = "type")]
    pub media_type: Option<String>,
}

impl DownloadUrl {
    pub fn get_url(&self) -> Option<&str> {
        self.file.as_deref().or(self.src.as_deref())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Caption {
    pub file: Option<String>,
    pub url: Option<String>,
    pub locale: Option<String>,
    pub title: Option<String>,
}

impl Caption {
    pub fn get_url(&self) -> Option<&str> {
        self.url.as_deref().or(self.file.as_deref())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DownloadUrlsMap {
    #[serde(rename = "Video", default)]
    pub video: Option<Vec<DownloadUrl>>,
    #[serde(rename = "File", default)]
    pub file: Option<Vec<DownloadUrl>>,
    #[serde(rename = "E-Book", default)]
    pub ebook: Option<Vec<DownloadUrl>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LectureAsset {
    pub body: Option<String>,
    pub filename: Option<String>,
    pub external_url: Option<String>,
    #[serde(default)]
    pub download_urls: Option<DownloadUrlsMap>,
    #[serde(default)]
    pub stream_urls: Option<DownloadUrlsMap>,
    #[serde(default)]
    pub media_sources: Option<Vec<DownloadUrl>>,
    #[serde(default)]
    pub captions: Option<Vec<Caption>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplementaryAsset {
    pub filename: Option<String>,
    pub download_urls: Option<DownloadUrlsMap>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LectureDetailResponse {
    pub asset: Option<LectureAsset>,
    #[serde(default)]
    pub supplementary_assets: Option<Vec<SupplementaryAsset>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: u64,
    pub title: Option<String>,
    pub image_50x50: Option<String>,
}
