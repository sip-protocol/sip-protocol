//! Privacy and Viewing Key Implementation for SIP Protocol.
//!
//! Provides:
//! - Viewing key generation and derivation
//! - XChaCha20-Poly1305 encryption/decryption
//! - Selective disclosure for compliance

use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::crypto::{bytes_to_hex, hex_to_bytes};
use crate::error::{Error, Result};
use crate::types::{EncryptedPayload, HexString, ViewingKey};

pub use crate::types::PrivacyLevel;

/// Generate a new viewing key for selective disclosure.
///
/// # Arguments
///
/// * `label` - Optional human-readable label
///
/// # Returns
///
/// ViewingKey object with key and hash
///
/// # Example
///
/// ```rust
/// use sip_protocol::generate_viewing_key;
///
/// let vk = generate_viewing_key(Some("audit-2024"));
/// ```
pub fn generate_viewing_key(label: Option<&str>) -> ViewingKey {
    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);

    let mut hasher = Sha256::new();
    hasher.update(&key);
    let key_hash = hasher.finalize();

    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    ViewingKey {
        key: bytes_to_hex(&key),
        key_hash: bytes_to_hex(&key_hash),
        created_at,
        label: label.map(String::from),
    }
}

/// Derive the hash of a viewing key.
///
/// This hash is used for indexing and verification without
/// exposing the actual key.
pub fn derive_viewing_key_hash(viewing_key: &str) -> Result<HexString> {
    let key_bytes = hex_to_bytes(viewing_key)?;

    let mut hasher = Sha256::new();
    hasher.update(&key_bytes);
    let hash = hasher.finalize();

    Ok(bytes_to_hex(&hash))
}

/// Encrypt data for viewing key holders.
///
/// Uses XChaCha20-Poly1305 for authenticated encryption.
///
/// # Arguments
///
/// * `viewing_key` - The viewing key (32 bytes)
/// * `plaintext` - Data to encrypt
///
/// # Returns
///
/// EncryptedPayload with ciphertext and nonce
pub fn encrypt_for_viewing_key(viewing_key: &str, plaintext: &[u8]) -> Result<EncryptedPayload> {
    let key_bytes = hex_to_bytes(viewing_key)?;

    if key_bytes.len() != 32 {
        return Err(Error::CryptoError("Viewing key must be 32 bytes".to_string()));
    }

    // Generate random nonce (24 bytes for XChaCha20)
    let mut nonce_bytes = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = XNonce::from_slice(&nonce_bytes);

    // Create cipher and encrypt
    let cipher = XChaCha20Poly1305::new_from_slice(&key_bytes)
        .map_err(|e| Error::EncryptionError(e.to_string()))?;

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| Error::EncryptionError(e.to_string()))?;

    Ok(EncryptedPayload {
        ciphertext: bytes_to_hex(&ciphertext),
        nonce: bytes_to_hex(&nonce_bytes),
    })
}

/// Decrypt data using a viewing key.
///
/// # Arguments
///
/// * `viewing_key` - The viewing key (32 bytes)
/// * `payload` - The encrypted payload (ciphertext + nonce)
///
/// # Returns
///
/// Decrypted plaintext
pub fn decrypt_with_viewing_key(viewing_key: &str, payload: &EncryptedPayload) -> Result<Vec<u8>> {
    let key_bytes = hex_to_bytes(viewing_key)?;
    let nonce_bytes = hex_to_bytes(&payload.nonce)?;
    let ciphertext = hex_to_bytes(&payload.ciphertext)?;

    if key_bytes.len() != 32 {
        return Err(Error::CryptoError("Viewing key must be 32 bytes".to_string()));
    }

    if nonce_bytes.len() != 24 {
        return Err(Error::DecryptionError("Invalid nonce length".to_string()));
    }

    let nonce = XNonce::from_slice(&nonce_bytes);

    let cipher = XChaCha20Poly1305::new_from_slice(&key_bytes)
        .map_err(|e| Error::DecryptionError(e.to_string()))?;

    cipher
        .decrypt(nonce, ciphertext.as_slice())
        .map_err(|e| Error::DecryptionError(e.to_string()))
}

/// Determine if encryption should be used for a privacy level.
pub fn should_encrypt(level: PrivacyLevel) -> bool {
    matches!(level, PrivacyLevel::Shielded | PrivacyLevel::Compliant)
}

/// Determine if viewing key should be included for a privacy level.
pub fn should_include_viewing_key(level: PrivacyLevel) -> bool {
    matches!(level, PrivacyLevel::Compliant)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_viewing_key() {
        let vk = generate_viewing_key(Some("test"));
        assert!(vk.key.starts_with("0x"));
        assert!(vk.key_hash.starts_with("0x"));
        assert_eq!(vk.label, Some("test".to_string()));
    }

    #[test]
    fn test_encrypt_decrypt() {
        let vk = generate_viewing_key(None);
        let plaintext = b"Hello, SIP Protocol!";

        let payload = encrypt_for_viewing_key(&vk.key, plaintext).unwrap();
        let decrypted = decrypt_with_viewing_key(&vk.key, &payload).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_derive_viewing_key_hash() {
        let vk = generate_viewing_key(None);
        let hash = derive_viewing_key_hash(&vk.key).unwrap();
        assert_eq!(hash, vk.key_hash);
    }
}
