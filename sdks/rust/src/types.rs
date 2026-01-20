//! Type definitions for SIP Protocol Rust SDK.
//!
//! These types mirror the TypeScript definitions in @sip-protocol/types.

use std::fmt;

/// A hex string with 0x prefix (e.g., "0x1234abcd")
pub type HexString = String;

/// Chain identifier (e.g., "ethereum", "solana", "near")
pub type ChainId = String;

/// A 32-byte hash as hex string with 0x prefix
pub type Hash = String;

/// A stealth meta-address containing public keys for generating one-time addresses.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StealthMetaAddress {
    /// Compressed secp256k1 public key (33 bytes, 0x02/0x03 prefix)
    pub spending_key: HexString,
    /// Compressed secp256k1 public key (33 bytes, 0x02/0x03 prefix)
    pub viewing_key: HexString,
    /// The blockchain this address is for
    pub chain: ChainId,
    /// Optional human-readable label
    pub label: Option<String>,
}

impl StealthMetaAddress {
    /// Create a new stealth meta-address
    pub fn new(spending_key: HexString, viewing_key: HexString, chain: ChainId) -> Self {
        Self {
            spending_key,
            viewing_key,
            chain,
            label: None,
        }
    }

    /// Create with a label
    pub fn with_label(
        spending_key: HexString,
        viewing_key: HexString,
        chain: ChainId,
        label: String,
    ) -> Self {
        Self {
            spending_key,
            viewing_key,
            chain,
            label: Some(label),
        }
    }
}

/// A one-time stealth address derived from a meta-address.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StealthAddress {
    /// The stealth address (compressed public key)
    pub address: HexString,
    /// The sender's ephemeral public key
    pub ephemeral_public_key: HexString,
    /// First byte of shared secret hash for efficient scanning
    pub view_tag: u8,
}

/// Recovery data for spending from a stealth address.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StealthAddressRecovery {
    /// The stealth address being recovered
    pub stealth_address: HexString,
    /// The ephemeral key used to generate the address
    pub ephemeral_public_key: HexString,
    /// The derived private key for spending
    pub private_key: HexString,
}

/// A Pedersen commitment with its blinding factor.
///
/// C = v*G + r*H where:
/// - v = value (hidden)
/// - r = blinding factor (random)
/// - G, H = independent generators
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PedersenCommitment {
    /// The commitment point (compressed, 33 bytes)
    pub commitment: HexString,
    /// The blinding factor (32 bytes, secret)
    pub blinding: HexString,
}

/// A viewing key for selective disclosure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ViewingKey {
    /// The viewing key (32 bytes)
    pub key: HexString,
    /// SHA-256 hash of the key for indexing
    pub key_hash: HexString,
    /// Unix timestamp of key creation (milliseconds)
    pub created_at: u64,
    /// Optional human-readable label
    pub label: Option<String>,
}

/// Privacy levels for SIP transactions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PrivacyLevel {
    /// No privacy, all data public
    Transparent,
    /// Full privacy, sender/amount/recipient hidden
    Shielded,
    /// Privacy with viewing key for auditors
    Compliant,
}

impl fmt::Display for PrivacyLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PrivacyLevel::Transparent => write!(f, "transparent"),
            PrivacyLevel::Shielded => write!(f, "shielded"),
            PrivacyLevel::Compliant => write!(f, "compliant"),
        }
    }
}

impl std::str::FromStr for PrivacyLevel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "transparent" => Ok(PrivacyLevel::Transparent),
            "shielded" => Ok(PrivacyLevel::Shielded),
            "compliant" => Ok(PrivacyLevel::Compliant),
            _ => Err(format!("Invalid privacy level: {}", s)),
        }
    }
}

/// Encrypted data with nonce for decryption.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EncryptedPayload {
    /// The encrypted data (hex)
    pub ciphertext: HexString,
    /// The nonce/IV used for encryption (hex)
    pub nonce: HexString,
}
