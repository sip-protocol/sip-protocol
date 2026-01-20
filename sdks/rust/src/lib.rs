//! # SIP Protocol Rust SDK
//!
//! The privacy standard for Web3. Stealth addresses, Pedersen commitments,
//! and viewing keys for compliant privacy.
//!
//! ## Quick Start
//!
//! ```rust
//! use sip_protocol::{
//!     stealth::{generate_stealth_meta_address, generate_stealth_address},
//!     commitment::commit,
//!     privacy::generate_viewing_key,
//! };
//!
//! // Generate stealth address keypair
//! let (meta, spending_priv, viewing_priv) = generate_stealth_meta_address("ethereum");
//!
//! // Generate one-time stealth address
//! let (stealth, shared_secret) = generate_stealth_address(&meta).unwrap();
//!
//! // Create Pedersen commitment
//! let (commitment, blinding) = commit(100).unwrap();
//! ```

pub mod commitment;
pub mod crypto;
pub mod error;
pub mod optimizations;
pub mod privacy;
pub mod stealth;
pub mod types;

pub use commitment::{
    add_blindings, add_commitments, commit, commit_zero, generate_blinding, get_generators,
    subtract_blindings, subtract_commitments, verify_opening,
};
pub use crypto::{generate_intent_id, generate_random_bytes, hash_sha256};
pub use error::{Error, Result};
pub use privacy::{
    decrypt_with_viewing_key, derive_viewing_key_hash, encrypt_for_viewing_key,
    generate_viewing_key, PrivacyLevel,
};
pub use stealth::{
    check_stealth_address, decode_stealth_meta_address, derive_stealth_private_key,
    encode_stealth_meta_address, generate_stealth_address, generate_stealth_meta_address,
    public_key_to_eth_address,
};
pub use types::{
    ChainId, EncryptedPayload, HexString, PedersenCommitment, StealthAddress,
    StealthAddressRecovery, StealthMetaAddress, ViewingKey,
};

/// SDK version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
