//! Pedersen Commitment Implementation for SIP Protocol.
//!
//! Cryptographically secure Pedersen commitments on secp256k1.
//!
//! # Security Properties
//!
//! - **Hiding (Computational)**: Cannot determine value from commitment
//! - **Binding (Computational)**: Cannot open commitment to different value
//! - **Homomorphic**: C(v1) + C(v2) = C(v1 + v2) when blindings sum
//!
//! # Generator H Construction
//!
//! H is constructed using "nothing-up-my-sleeve" (NUMS) method to ensure
//! nobody knows the discrete log of H w.r.t. G.

use k256::{
    elliptic_curve::{
        group::GroupEncoding,
        sec1::{FromEncodedPoint, ToEncodedPoint},
        Field, PrimeField,
    },
    AffinePoint, ProjectivePoint, Scalar,
};
use rand::RngCore;
use sha2::{Digest, Sha256};

use crate::crypto::{bytes_to_hex, hex_to_bytes};
use crate::error::{Error, Result};
use crate::types::HexString;

/// Domain separation tag for H generation
const H_DOMAIN: &str = "SIP-PEDERSEN-GENERATOR-H-v1";

/// The base generator G (secp256k1)
fn get_generator_g() -> ProjectivePoint {
    ProjectivePoint::GENERATOR
}

/// Generate the independent generator H using NUMS method.
fn generate_h() -> ProjectivePoint {
    for counter in 0..256 {
        // Create candidate x-coordinate
        let input = format!("{}:{}", H_DOMAIN, counter);
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        let hash = hasher.finalize();

        // Try to create a point from this x-coordinate (with even y)
        let mut point_bytes = [0u8; 33];
        point_bytes[0] = 0x02; // Compressed, even y
        point_bytes[1..].copy_from_slice(&hash);

        if let Ok(point) = AffinePoint::from_bytes(&point_bytes.into()) {
            let proj = ProjectivePoint::from(point);
            if !proj.is_identity().into() && proj != ProjectivePoint::GENERATOR {
                return proj;
            }
        }
    }

    panic!("Failed to generate H point - this should never happen");
}

lazy_static::lazy_static! {
    static ref H: ProjectivePoint = generate_h();
}

/// Create a Pedersen commitment to a value.
///
/// C = v*G + r*H
///
/// Where:
/// - v = value (the amount being committed)
/// - r = blinding factor (random, keeps value hidden)
/// - G = base generator
/// - H = independent generator (NUMS)
///
/// # Arguments
///
/// * `value` - The value to commit to
///
/// # Returns
///
/// Tuple of (commitment, blinding) as hex strings
///
/// # Example
///
/// ```rust
/// use sip_protocol::commit;
///
/// let (commitment, blinding) = commit(100).unwrap();
/// ```
pub fn commit(value: u64) -> Result<(HexString, HexString)> {
    // Generate random blinding factor
    let mut blinding_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut blinding_bytes);

    commit_with_blinding(value, &blinding_bytes)
}

/// Create a Pedersen commitment with a specific blinding factor.
pub fn commit_with_blinding(value: u64, blinding: &[u8]) -> Result<(HexString, HexString)> {
    if blinding.len() != 32 {
        return Err(Error::CryptoError("Blinding must be 32 bytes".to_string()));
    }

    let g = get_generator_g();

    // Convert value and blinding to scalars
    let v_scalar = Scalar::from(value);
    let r_scalar = Scalar::from_repr_vartime((*blinding).into())
        .ok_or_else(|| Error::CryptoError("Invalid blinding scalar".to_string()))?;

    if r_scalar.is_zero().into() {
        return Err(Error::CryptoError(
            "Zero blinding scalar - investigate RNG".to_string(),
        ));
    }

    // C = v*G + r*H
    let commitment = if value == 0 {
        // Only blinding contributes: C = r*H
        *H * r_scalar
    } else {
        // Normal case: C = v*G + r*H
        g * v_scalar + *H * r_scalar
    };

    let commitment_bytes = commitment.to_affine().to_bytes();

    Ok((
        bytes_to_hex(&commitment_bytes),
        bytes_to_hex(blinding),
    ))
}

/// Verify that a commitment opens to a specific value.
///
/// Recomputes C' = v*G + r*H and checks if C' == C
///
/// # Arguments
///
/// * `commitment` - The commitment point to verify
/// * `value` - The claimed value
/// * `blinding` - The blinding factor used
///
/// # Returns
///
/// true if the commitment opens correctly
pub fn verify_opening(commitment: &str, value: u64, blinding: &str) -> Result<bool> {
    let commitment_bytes = hex_to_bytes(commitment)?;
    let blinding_bytes = hex_to_bytes(blinding)?;

    let g = get_generator_g();

    // Parse commitment point
    let c_point = AffinePoint::from_bytes(commitment_bytes.as_slice().into())
        .map(ProjectivePoint::from)
        .map_err(|_| Error::InvalidPublicKey("Invalid commitment point".to_string()))?;

    // Recompute expected commitment
    let v_scalar = Scalar::from(value);
    let r_scalar = Scalar::from_repr_vartime(blinding_bytes.as_slice().try_into().unwrap())
        .ok_or_else(|| Error::CryptoError("Invalid blinding scalar".to_string()))?;

    let expected = if value == 0 {
        *H * r_scalar
    } else {
        g * v_scalar + *H * r_scalar
    };

    Ok(c_point == expected)
}

/// Create a commitment to zero with a specific blinding factor.
///
/// C = 0*G + r*H = r*H
pub fn commit_zero(blinding: &[u8]) -> Result<(HexString, HexString)> {
    commit_with_blinding(0, blinding)
}

/// Add two commitments homomorphically.
///
/// C1 + C2 = (v1*G + r1*H) + (v2*G + r2*H) = (v1+v2)*G + (r1+r2)*H
pub fn add_commitments(c1: &str, c2: &str) -> Result<HexString> {
    let c1_bytes = hex_to_bytes(c1)?;
    let c2_bytes = hex_to_bytes(c2)?;

    let point1 = AffinePoint::from_bytes(c1_bytes.as_slice().into())
        .map(ProjectivePoint::from)
        .map_err(|_| Error::InvalidPublicKey("Invalid commitment c1".to_string()))?;

    let point2 = AffinePoint::from_bytes(c2_bytes.as_slice().into())
        .map(ProjectivePoint::from)
        .map_err(|_| Error::InvalidPublicKey("Invalid commitment c2".to_string()))?;

    let sum = point1 + point2;
    Ok(bytes_to_hex(&sum.to_affine().to_bytes()))
}

/// Subtract two commitments homomorphically.
///
/// C1 - C2 = (v1-v2)*G + (r1-r2)*H
pub fn subtract_commitments(c1: &str, c2: &str) -> Result<HexString> {
    let c1_bytes = hex_to_bytes(c1)?;
    let c2_bytes = hex_to_bytes(c2)?;

    let point1 = AffinePoint::from_bytes(c1_bytes.as_slice().into())
        .map(ProjectivePoint::from)
        .map_err(|_| Error::InvalidPublicKey("Invalid commitment c1".to_string()))?;

    let point2 = AffinePoint::from_bytes(c2_bytes.as_slice().into())
        .map(ProjectivePoint::from)
        .map_err(|_| Error::InvalidPublicKey("Invalid commitment c2".to_string()))?;

    let diff = point1 - point2;
    Ok(bytes_to_hex(&diff.to_affine().to_bytes()))
}

/// Add blinding factors (for use with homomorphic addition).
pub fn add_blindings(b1: &str, b2: &str) -> Result<HexString> {
    let b1_bytes = hex_to_bytes(b1)?;
    let b2_bytes = hex_to_bytes(b2)?;

    let s1 = Scalar::from_repr_vartime(b1_bytes.as_slice().try_into().unwrap())
        .ok_or_else(|| Error::CryptoError("Invalid blinding b1".to_string()))?;
    let s2 = Scalar::from_repr_vartime(b2_bytes.as_slice().try_into().unwrap())
        .ok_or_else(|| Error::CryptoError("Invalid blinding b2".to_string()))?;

    let sum = s1 + s2;
    Ok(bytes_to_hex(&sum.to_bytes()))
}

/// Subtract blinding factors (for use with homomorphic subtraction).
pub fn subtract_blindings(b1: &str, b2: &str) -> Result<HexString> {
    let b1_bytes = hex_to_bytes(b1)?;
    let b2_bytes = hex_to_bytes(b2)?;

    let s1 = Scalar::from_repr_vartime(b1_bytes.as_slice().try_into().unwrap())
        .ok_or_else(|| Error::CryptoError("Invalid blinding b1".to_string()))?;
    let s2 = Scalar::from_repr_vartime(b2_bytes.as_slice().try_into().unwrap())
        .ok_or_else(|| Error::CryptoError("Invalid blinding b2".to_string()))?;

    let diff = s1 - s2;
    Ok(bytes_to_hex(&diff.to_bytes()))
}

/// Generate a random blinding factor.
pub fn generate_blinding() -> HexString {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes_to_hex(&bytes)
}

/// Get the generators for ZK proof integration.
pub fn get_generators() -> (HexString, HexString, HexString, HexString) {
    let g = get_generator_g().to_affine();
    let h = H.to_affine();

    let g_encoded = g.to_encoded_point(false);
    let h_encoded = h.to_encoded_point(false);

    (
        bytes_to_hex(g_encoded.x().unwrap()),
        bytes_to_hex(g_encoded.y().unwrap()),
        bytes_to_hex(h_encoded.x().unwrap()),
        bytes_to_hex(h_encoded.y().unwrap()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_commit_and_verify() {
        let (commitment, blinding) = commit(100).unwrap();
        assert!(verify_opening(&commitment, 100, &blinding).unwrap());
        assert!(!verify_opening(&commitment, 101, &blinding).unwrap());
    }

    #[test]
    fn test_homomorphic_addition() {
        let (c1, b1) = commit(100).unwrap();
        let (c2, b2) = commit(50).unwrap();

        let c_sum = add_commitments(&c1, &c2).unwrap();
        let b_sum = add_blindings(&b1, &b2).unwrap();

        assert!(verify_opening(&c_sum, 150, &b_sum).unwrap());
    }
}
