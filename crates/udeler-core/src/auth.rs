use reqwest::header::{
    HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, AUTHORIZATION, COOKIE, USER_AGENT,
};
use serde::{Deserialize, Serialize};

/// Sanitizes a raw user or stored token, stripping surrounding quotes, prefixes,
/// and any trailing cookie segments.
pub fn sanitize_token(token: &str) -> String {
    let mut cleaned = token.trim();

    // 1. Strip outer quotes if wrapping the entire string
    cleaned = cleaned.trim_matches(|c| c == '"' || c == '\'').trim();

    // 2. Strip "Bearer " prefix (case-insensitive)
    if cleaned.to_ascii_lowercase().starts_with("bearer ") {
        cleaned = cleaned[7..].trim();
    }

    // 3. Strip "access_token=" prefix (case-insensitive)
    if cleaned.to_ascii_lowercase().starts_with("access_token=") {
        cleaned = cleaned[13..].trim();
    }

    // 4. Take only the first segment if separated by semicolons
    if let Some((first, _)) = cleaned.split_once(';') {
        cleaned = first.trim();
    }

    // 5. Strip quotes again in case the cookie value itself was quoted (e.g. `"Nv2..."`)
    cleaned = cleaned.trim_matches(|c| c == '"' || c == '\'').trim();

    // 6. Filter strictly to printable ASCII (0x20..=0x7E) without quotes
    cleaned
        .chars()
        .filter(|c| c.is_ascii() && !c.is_ascii_control() && *c != '"' && *c != '\'')
        .collect::<String>()
        .trim()
        .to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct AuthCredentials {
    pub token: String,
    pub subdomain: Option<String>,
    #[serde(default)]
    pub extra_cookies: Option<String>,
}

impl AuthCredentials {
    pub fn new(raw_token: &str, subdomain: Option<String>) -> Self {
        let token = sanitize_token(raw_token);
        let extra_cookies = raw_token
            .split_once(';')
            .map(|(_, rest)| {
                rest.chars()
                    .filter(|c| c.is_ascii() && !c.is_ascii_control())
                    .collect::<String>()
                    .trim()
                    .to_string()
            })
            .filter(|s| !s.is_empty());

        Self {
            token,
            subdomain: subdomain
                .map(|s| s.trim().to_lowercase())
                .filter(|s| !s.is_empty()),
            extra_cookies,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.token.is_empty()
    }

    pub fn base_url(&self) -> String {
        match &self.subdomain {
            Some(sub) => format!("https://{}.udemy.com", sub),
            None => "https://www.udemy.com".to_string(),
        }
    }

    /// Constructs HTTP request headers required for authenticating with Udemy API endpoints.
    pub fn build_headers(&self) -> Result<HeaderMap, reqwest::header::InvalidHeaderValue> {
        let mut headers = HeaderMap::new();

        let auth_val = format!("Bearer {}", self.token);
        headers.insert(AUTHORIZATION, HeaderValue::from_str(&auth_val)?);
        headers.insert("X-Udemy-Authorization", HeaderValue::from_str(&auth_val)?);

        let cookie_val = format!("access_token={}", self.token);
        headers.insert(COOKIE, HeaderValue::from_str(&cookie_val)?);

        headers.insert(ACCEPT, HeaderValue::from_static("application/json, text/plain, */*"));
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("okhttp/4.12.0 UdemyAndroid/9.49.2 (499) (phone)"),
        );
        headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("en-US,en;q=0.9"));

        Ok(headers)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_token() {
        assert_eq!(sanitize_token("  Bearer abc123def  "), "abc123def");
        assert_eq!(sanitize_token("\"access_token=xyz789; other=1\""), "xyz789");
        assert_eq!(sanitize_token("access_token=\"Nv2123\"; cf=1"), "Nv2123");
        assert_eq!(sanitize_token("\"Nv2123\""), "Nv2123");
        assert_eq!(sanitize_token("'my_token'"), "my_token");
        let with_unicode = format!("valid_token_{}", '\u{FFFD}');
        assert_eq!(sanitize_token(&with_unicode), "valid_token_");
    }

    #[test]
    fn test_base_url() {
        let creds_standard = AuthCredentials::new("token123", None);
        assert_eq!(creds_standard.base_url(), "https://www.udemy.com");
        let creds_sub = AuthCredentials::new("token123", Some("business".into()));
        assert_eq!(creds_sub.base_url(), "https://business.udemy.com");
    }
}