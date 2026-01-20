//! Error types for SIP Protocol SDK.

use thiserror::Error;

/// Result type for SIP Protocol operations
pub type Result<T> = std::result::Result<T, Error>;

/// Error types for SIP Protocol SDK
#[derive(Error, Debug)]
pub enum Error {
    /// Invalid hex string format
    #[error("Invalid hex string: {0}")]
    InvalidHex(String),

    /// Invalid public key
    #[error("Invalid public key: {0}")]
    InvalidPublicKey(String),

    /// Invalid private key
    #[error("Invalid private key: {0}")]
    InvalidPrivateKey(String),

    /// Invalid stealth meta-address format
    #[error("Invalid stealth meta-address: {0}")]
    InvalidStealthMetaAddress(String),

    /// Value out of range
    #[error("Value out of range: {0}")]
    ValueOutOfRange(String),

    /// Cryptographic operation failed
    #[error("Crypto error: {0}")]
    CryptoError(String),

    /// Encryption failed
    #[error("Encryption error: {0}")]
    EncryptionError(String),

    /// Decryption failed
    #[error("Decryption error: {0}")]
    DecryptionError(String),

    /// Invalid chain ID
    #[error("Invalid chain ID: {0}")]
    InvalidChainId(String),

    /// Verification failed
    #[error("Verification failed: {0}")]
    VerificationFailed(String),
}
