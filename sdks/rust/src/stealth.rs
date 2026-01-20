//! Stealth Address Implementation for SIP Protocol.
//!
//! Implements EIP-5564 style stealth addresses using secp256k1.
//! Used for Ethereum, Polygon, Arbitrum, Optimism, Base, Bitcoin, Zcash.
//!
//! # Protocol
//!
//! Stealth addresses provide unlinkable payments:
//! 1. Sender generates one-time address from recipient's public meta-address
//! 2. Recipient scans blockchain using view tag for efficient filtering
//! 3. Only recipient can derive the private key to spend

use k256::{
    ecdh::EphemeralSecret,
    elliptic_curve::{group::GroupEncoding, sec1::FromEncodedPoint, PrimeField},
    AffinePoint, ProjectivePoint, PublicKey, Scalar, SecretKey,
};
use rand::rngs::OsRng;
use sha2::{Digest, Sha256};
use sha3::Keccak256;

use crate::crypto::{bytes_to_hex, hex_to_bytes};
use crate::error::{Error, Result};
use crate::types::{ChainId, HexString, StealthAddress, StealthAddressRecovery, StealthMetaAddress};

/// Generate a new stealth meta-address keypair.
///
/// # Arguments
///
/// * `chain` - The blockchain this address is for
///
/// # Returns
///
/// Tuple of (meta_address, spending_private_key, viewing_private_key)
///
/// # Example
///
/// ```rust
/// use sip_protocol::generate_stealth_meta_address;
///
/// let (meta, spending_priv, viewing_priv) = generate_stealth_meta_address("ethereum");
/// ```
pub fn generate_stealth_meta_address(chain: &str) -> (StealthMetaAddress, HexString, HexString) {
    // Generate random private keys
    let spending_secret = SecretKey::random(&mut OsRng);
    let viewing_secret = SecretKey::random(&mut OsRng);

    // Derive public keys (compressed)
    let spending_pub = spending_secret.public_key();
    let viewing_pub = viewing_secret.public_key();

    let meta_address = StealthMetaAddress::new(
        bytes_to_hex(&spending_pub.to_sec1_bytes()),
        bytes_to_hex(&viewing_pub.to_sec1_bytes()),
        chain.to_string(),
    );

    (
        meta_address,
        bytes_to_hex(&spending_secret.to_bytes()),
        bytes_to_hex(&viewing_secret.to_bytes()),
    )
}

/// Generate a one-time stealth address for a recipient.
///
/// # Protocol
///
/// 1. Sender generates ephemeral keypair (r, R = r*G)
/// 2. Compute shared secret: S = r * P_spend
/// 3. Compute stealth address: A = Q_view + hash(S)*G
/// 4. View tag = first byte of hash(S) for efficient scanning
///
/// # Arguments
///
/// * `recipient_meta_address` - The recipient's stealth meta-address
///
/// # Returns
///
/// Tuple of (stealth_address, shared_secret)
pub fn generate_stealth_address(
    recipient_meta_address: &StealthMetaAddress,
) -> Result<(StealthAddress, HexString)> {
    // Generate ephemeral keypair
    let ephemeral_secret = SecretKey::random(&mut OsRng);
    let ephemeral_pub = ephemeral_secret.public_key();

    // Parse recipient's keys
    let spending_key_bytes = hex_to_bytes(&recipient_meta_address.spending_key)?;
    let viewing_key_bytes = hex_to_bytes(&recipient_meta_address.viewing_key)?;

    let spending_pub = PublicKey::from_sec1_bytes(&spending_key_bytes)
        .map_err(|_| Error::InvalidPublicKey("Invalid spending key".to_string()))?;
    let viewing_pub = PublicKey::from_sec1_bytes(&viewing_key_bytes)
        .map_err(|_| Error::InvalidPublicKey("Invalid viewing key".to_string()))?;

    // Compute shared secret: S = r * P_spend
    let shared_secret_point = k256::ecdh::diffie_hellman(
        ephemeral_secret.to_nonzero_scalar(),
        spending_pub.as_affine(),
    );

    // Hash the shared secret for use as a scalar
    let mut hasher = Sha256::new();
    hasher.update(shared_secret_point.raw_secret_bytes());
    let shared_secret_hash: [u8; 32] = hasher.finalize().into();

    // Compute stealth address: A = Q_view + hash(S)*G
    let hash_scalar = Scalar::from_repr_vartime(shared_secret_hash.into())
        .ok_or_else(|| Error::CryptoError("Invalid hash scalar".to_string()))?;

    let hash_times_g = ProjectivePoint::GENERATOR * hash_scalar;
    let viewing_point = ProjectivePoint::from(*viewing_pub.as_affine());
    let stealth_point = viewing_point + hash_times_g;
    let stealth_address_bytes = stealth_point.to_affine().to_bytes();

    // View tag (first byte of hash for efficient scanning)
    let view_tag = shared_secret_hash[0];

    let stealth_address = StealthAddress {
        address: bytes_to_hex(&stealth_address_bytes),
        ephemeral_public_key: bytes_to_hex(&ephemeral_pub.to_sec1_bytes()),
        view_tag,
    };

    Ok((stealth_address, bytes_to_hex(&shared_secret_hash)))
}

/// Derive the private key for a stealth address.
///
/// # Protocol
///
/// 1. Compute shared secret: S = p_spend * R_ephemeral
/// 2. Derive stealth private key: q_view + hash(S) mod n
pub fn derive_stealth_private_key(
    stealth_address: &StealthAddress,
    spending_private_key: &str,
    viewing_private_key: &str,
) -> Result<StealthAddressRecovery> {
    let spending_priv_bytes = hex_to_bytes(spending_private_key)?;
    let viewing_priv_bytes = hex_to_bytes(viewing_private_key)?;
    let ephemeral_pub_bytes = hex_to_bytes(&stealth_address.ephemeral_public_key)?;

    let spending_secret = SecretKey::from_slice(&spending_priv_bytes)
        .map_err(|_| Error::InvalidPrivateKey("Invalid spending key".to_string()))?;
    let ephemeral_pub = PublicKey::from_sec1_bytes(&ephemeral_pub_bytes)
        .map_err(|_| Error::InvalidPublicKey("Invalid ephemeral key".to_string()))?;

    // Compute shared secret: S = p_spend * R_ephemeral
    let shared_secret_point = k256::ecdh::diffie_hellman(
        spending_secret.to_nonzero_scalar(),
        ephemeral_pub.as_affine(),
    );

    // Hash the shared secret
    let mut hasher = Sha256::new();
    hasher.update(shared_secret_point.raw_secret_bytes());
    let shared_secret_hash: [u8; 32] = hasher.finalize().into();

    // Derive stealth private key: q_view + hash(S) mod n
    let viewing_scalar = Scalar::from_repr_vartime(viewing_priv_bytes.as_slice().try_into().unwrap())
        .ok_or_else(|| Error::InvalidPrivateKey("Invalid viewing scalar".to_string()))?;
    let hash_scalar = Scalar::from_repr_vartime(shared_secret_hash.into())
        .ok_or_else(|| Error::CryptoError("Invalid hash scalar".to_string()))?;

    let stealth_private_scalar = viewing_scalar + hash_scalar;

    Ok(StealthAddressRecovery {
        stealth_address: stealth_address.address.clone(),
        ephemeral_public_key: stealth_address.ephemeral_public_key.clone(),
        private_key: bytes_to_hex(&stealth_private_scalar.to_bytes()),
    })
}

/// Check if a stealth address belongs to this recipient.
///
/// Uses view tag for efficient filtering, then does full verification.
pub fn check_stealth_address(
    stealth_address: &StealthAddress,
    spending_private_key: &str,
    viewing_private_key: &str,
) -> Result<bool> {
    let spending_priv_bytes = hex_to_bytes(spending_private_key)?;
    let viewing_priv_bytes = hex_to_bytes(viewing_private_key)?;
    let ephemeral_pub_bytes = hex_to_bytes(&stealth_address.ephemeral_public_key)?;

    let spending_secret = SecretKey::from_slice(&spending_priv_bytes)
        .map_err(|_| Error::InvalidPrivateKey("Invalid spending key".to_string()))?;
    let ephemeral_pub = PublicKey::from_sec1_bytes(&ephemeral_pub_bytes)
        .map_err(|_| Error::InvalidPublicKey("Invalid ephemeral key".to_string()))?;

    // Compute shared secret
    let shared_secret_point = k256::ecdh::diffie_hellman(
        spending_secret.to_nonzero_scalar(),
        ephemeral_pub.as_affine(),
    );

    let mut hasher = Sha256::new();
    hasher.update(shared_secret_point.raw_secret_bytes());
    let shared_secret_hash: [u8; 32] = hasher.finalize().into();

    // Quick view tag check
    if shared_secret_hash[0] != stealth_address.view_tag {
        return Ok(false);
    }

    // Full verification: derive expected stealth address
    let viewing_scalar = Scalar::from_repr_vartime(viewing_priv_bytes.as_slice().try_into().unwrap())
        .ok_or_else(|| Error::InvalidPrivateKey("Invalid viewing scalar".to_string()))?;
    let hash_scalar = Scalar::from_repr_vartime(shared_secret_hash.into())
        .ok_or_else(|| Error::CryptoError("Invalid hash scalar".to_string()))?;

    let stealth_private_scalar = viewing_scalar + hash_scalar;

    // Compute expected public key
    let expected_point = ProjectivePoint::GENERATOR * stealth_private_scalar;
    let expected_bytes = expected_point.to_affine().to_bytes();

    // Compare with provided stealth address
    let provided_bytes = hex_to_bytes(&stealth_address.address)?;

    Ok(expected_bytes.as_slice() == provided_bytes.as_slice())
}

/// Convert a secp256k1 public key to an Ethereum address.
///
/// Algorithm (EIP-55):
/// 1. Decompress the public key to uncompressed form (65 bytes)
/// 2. Remove the 0x04 prefix (take last 64 bytes)
/// 3. keccak256 hash of the 64 bytes
/// 4. Take the last 20 bytes as the address
/// 5. Apply EIP-55 checksum
pub fn public_key_to_eth_address(public_key: &str) -> Result<HexString> {
    let key_bytes = hex_to_bytes(public_key)?;

    let pub_key = PublicKey::from_sec1_bytes(&key_bytes)
        .map_err(|_| Error::InvalidPublicKey("Invalid public key".to_string()))?;

    // Get uncompressed public key (65 bytes starting with 0x04)
    let uncompressed = pub_key.to_encoded_point(false);
    let pub_key_bytes = uncompressed.as_bytes();

    // Remove 0x04 prefix and keccak256 hash
    let pub_key_without_prefix = &pub_key_bytes[1..];
    let mut hasher = Keccak256::new();
    hasher.update(pub_key_without_prefix);
    let hash = hasher.finalize();

    // Take last 20 bytes
    let address_bytes = &hash[12..];
    let address_hex = hex::encode(address_bytes);

    // Apply EIP-55 checksum
    let mut checksum_hasher = Keccak256::new();
    checksum_hasher.update(address_hex.as_bytes());
    let checksum_hash = checksum_hasher.finalize();

    let mut checksummed = String::with_capacity(40);
    for (i, c) in address_hex.chars().enumerate() {
        if c.is_ascii_digit() {
            checksummed.push(c);
        } else {
            let nibble = (checksum_hash[i / 2] >> (4 * (1 - (i % 2)))) & 0x0f;
            if nibble >= 8 {
                checksummed.push(c.to_ascii_uppercase());
            } else {
                checksummed.push(c.to_ascii_lowercase());
            }
        }
    }

    Ok(format!("0x{}", checksummed))
}

/// Encode a stealth meta-address to SIP format.
///
/// Format: sip:<chain>:<spending_key>:<viewing_key>
pub fn encode_stealth_meta_address(meta_address: &StealthMetaAddress) -> String {
    format!(
        "sip:{}:{}:{}",
        meta_address.chain, meta_address.spending_key, meta_address.viewing_key
    )
}

/// Decode a SIP-encoded stealth meta-address.
pub fn decode_stealth_meta_address(encoded: &str) -> Result<StealthMetaAddress> {
    let parts: Vec<&str> = encoded.split(':').collect();
    if parts.len() != 4 || parts[0] != "sip" {
        return Err(Error::InvalidStealthMetaAddress(format!(
            "Invalid format: {}",
            encoded
        )));
    }

    Ok(StealthMetaAddress::new(
        parts[2].to_string(),
        parts[3].to_string(),
        parts[1].to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_and_recover() {
        let (meta, spending_priv, viewing_priv) = generate_stealth_meta_address("ethereum");

        let (stealth, _) = generate_stealth_address(&meta).unwrap();

        assert!(check_stealth_address(&stealth, &spending_priv, &viewing_priv).unwrap());

        let recovery =
            derive_stealth_private_key(&stealth, &spending_priv, &viewing_priv).unwrap();
        assert!(!recovery.private_key.is_empty());
    }

    #[test]
    fn test_encode_decode_meta_address() {
        let (meta, _, _) = generate_stealth_meta_address("ethereum");

        let encoded = encode_stealth_meta_address(&meta);
        let decoded = decode_stealth_meta_address(&encoded).unwrap();

        assert_eq!(meta.chain, decoded.chain);
        assert_eq!(meta.spending_key, decoded.spending_key);
        assert_eq!(meta.viewing_key, decoded.viewing_key);
    }
}
