use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;

const SALT: &[u8] = b"Udeler-Reborn-v4-PureRust-Vault-Salt";

pub struct Vault {
    cipher: Aes256Gcm,
}

impl Vault {
    /// Creates a Vault with a key derived from system & user specific identifiers
    pub fn new() -> Self {
        let key = Self::derive_machine_key();
        let cipher = Aes256Gcm::new_from_slice(&key).expect("32 bytes is valid AES-256 key");
        Self { cipher }
    }

    fn derive_machine_key() -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(SALT);

        // Include user home directory
        if let Some(user_dirs) = directories::UserDirs::new() {
            hasher.update(user_dirs.home_dir().to_string_lossy().as_bytes());
        }

        // On Linux, try /etc/machine-id or /var/lib/dbus/machine-id
        if let Ok(machine_id) = fs::read_to_string("/etc/machine-id") {
            hasher.update(machine_id.trim().as_bytes());
        } else if let Ok(dbus_id) = fs::read_to_string("/var/lib/dbus/machine-id") {
            hasher.update(dbus_id.trim().as_bytes());
        }

        // Include hostname
        if let Ok(hostname) = std::env::var("HOSTNAME") {
            hasher.update(hostname.as_bytes());
        }

        let result = hasher.finalize();
        let mut key = [0u8; 32];
        key.copy_from_slice(&result);
        key
    }

    /// Encrypts plaintext string returning base64 encoded payload (nonce + ciphertext)
    pub fn encrypt(&self, plaintext: &str) -> Result<String, String> {
        let mut nonce_bytes = [0u8; 12];
        // Generate pseudo-random nonce based on time and hash
        let seed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let mut nonce_hasher = Sha256::new();
        nonce_hasher.update(seed.to_le_bytes());
        nonce_hasher.update(plaintext.as_bytes());
        let hash = nonce_hasher.finalize();
        nonce_bytes.copy_from_slice(&hash[..12]);

        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = self
            .cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| format!("Encryption error: {}", e))?;

        let mut combined = Vec::with_capacity(12 + ciphertext.len());
        combined.extend_from_slice(&nonce_bytes);
        combined.extend_from_slice(&ciphertext);

        Ok(BASE64.encode(combined))
    }

    /// Decrypts base64 encoded payload (nonce + ciphertext)
    pub fn decrypt(&self, encrypted_b64: &str) -> Result<String, String> {
        let combined = BASE64
            .decode(encrypted_b64.trim())
            .map_err(|e| format!("Base64 decode error: {}", e))?;

        if combined.len() < 12 {
            return Err("Encrypted payload too short (missing nonce)".into());
        }

        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let decrypted_bytes = self
            .cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| format!("Decryption error (data may be corrupted or from another machine): {}", e))?;

        String::from_utf8(decrypted_bytes).map_err(|e| format!("UTF-8 conversion error: {}", e))
    }

    /// Returns standard storage path for Udeler configuration
    pub fn get_storage_path() -> PathBuf {
        if let Some(proj_dirs) = directories::ProjectDirs::from("com", "udeler", "Udeler-Reborn") {
            let config_dir = proj_dirs.config_dir();
            let _ = fs::create_dir_all(config_dir);
            config_dir.to_path_buf()
        } else {
            PathBuf::from(".udeler")
        }
    }
}

impl Default for Vault {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vault_encrypt_decrypt() {
        let vault = Vault::new();
        let secret = "my_super_secret_udemy_token_1234567890";
        let encrypted = vault.encrypt(secret).expect("encrypt succeeded");
        assert_ne!(secret, encrypted);

        let decrypted = vault.decrypt(&encrypted).expect("decrypt succeeded");
        assert_eq!(secret, decrypted);
    }
}
