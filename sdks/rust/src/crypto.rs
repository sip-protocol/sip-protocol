//! Cryptographic utilities for SIP Protocol.
//!
//! Provides low-level cryptographic primitives including:
//! - Hash functions (SHA-256)
//! - Random number generation
//! - Intent ID generation

use rand::RngCore;
use sha2::{Digest, Sha256};

use crate::error::{Error, Result};
use crate::types::{Hash, HexString};

/// Compute SHA-256 hash of data.
///
/// # Arguments
///
/// * `data` - Input data as bytes
///
/// # Returns
///
/// 32-byte hash as hex string with 0x prefix
///
/// # Example
///
/// ```rust
/// use sip_protocol::hash_sha256;
///
/// let hash = hash_sha256(b"Hello, SIP Protocol!");
/// println!("{}", hash);
/// ```
pub fn hash_sha256(data: &[u8]) -> Hash {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    format!("0x{}", hex::encode(result))
}

/// Generate cryptographically secure random bytes.
///
/// Uses the platform's secure random source.
///
/// # Arguments
///
/// * `length` - Number of random bytes to generate
///
/// # Returns
///
/// Random bytes as hex string with 0x prefix
///
/// # Example
///
/// ```rust
/// use sip_protocol::generate_random_bytes;
///
/// let random = generate_random_bytes(32); // 32-byte private key
/// ```
pub fn generate_random_bytes(length: usize) -> HexString {
    let mut bytes = vec![0u8; length];
    rand::thread_rng().fill_bytes(&mut bytes);
    format!("0x{}", hex::encode(bytes))
}

/// Generate a unique intent identifier.
///
/// Creates a cryptographically random intent ID with the `sip-` prefix.
/// IDs are globally unique with negligible collision probability (128-bit).
///
/// # Returns
///
/// Intent ID string in format: `sip-<32 hex chars>`
///
/// # Example
///
/// ```rust
/// use sip_protocol::generate_intent_id;
///
/// let id = generate_intent_id();
/// println!("{}", id); // sip-a1b2c3d4e5f67890a1b2c3d4e5f67890
/// ```
pub fn generate_intent_id() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    format!("sip-{}", hex::encode(bytes))
}

/// Convert hex string to bytes.
///
/// # Arguments
///
/// * `hex_str` - Hex string with or without 0x prefix
///
/// # Returns
///
/// Raw bytes
pub fn hex_to_bytes(hex_str: &str) -> Result<Vec<u8>> {
    let hex_str = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    hex::decode(hex_str).map_err(|e| Error::InvalidHex(e.to_string()))
}

/// Convert bytes to hex string with 0x prefix.
///
/// # Arguments
///
/// * `data` - Raw bytes
///
/// # Returns
///
/// Hex string with 0x prefix
pub fn bytes_to_hex(data: &[u8]) -> HexString {
    format!("0x{}", hex::encode(data))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_sha256() {
        let hash = hash_sha256(b"hello");
        assert!(hash.starts_with("0x"));
        assert_eq!(hash.len(), 66); // 0x + 64 hex chars
    }

    #[test]
    fn test_generate_random_bytes() {
        let random = generate_random_bytes(32);
        assert!(random.starts_with("0x"));
        assert_eq!(random.len(), 66); // 0x + 64 hex chars
    }

    #[test]
    fn test_generate_intent_id() {
        let id = generate_intent_id();
        assert!(id.starts_with("sip-"));
        assert_eq!(id.len(), 36); // sip- + 32 hex chars
    }

    #[test]
    fn test_hex_conversion() {
        let original = vec![1, 2, 3, 4];
        let hex = bytes_to_hex(&original);
        let bytes = hex_to_bytes(&hex).unwrap();
        assert_eq!(original, bytes);
    }
}
