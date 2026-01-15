//! ZK Proof Verification Module for Solana
//!
//! This module provides on-chain verification of Noir ZK proofs using
//! the UltraHonk/Barretenberg proof system.
//!
//! ## Overview
//!
//! SIP Protocol uses three types of ZK proofs:
//!
//! 1. **Funding Proof**: Proves sufficient balance without revealing amount
//! 2. **Validity Proof**: Proves intent authorization without revealing sender
//! 3. **Fulfillment Proof**: Proves correct execution without revealing path
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────────────────┐
//! │  OFF-CHAIN (Client SDK)                                                 │
//! │  ┌───────────────┐    ┌──────────────────┐    ┌────────────────────┐   │
//! │  │ NoirProof     │───►│ SolanaNoirVerifier│───►│ Serialize proof  │   │
//! │  │ Provider      │    │                   │    │ for Solana       │   │
//! │  └───────────────┘    └───────────────────┘    └──────────┬───────┘   │
//! └───────────────────────────────────────────────────────────┼───────────┘
//!                                                             │
//!                                                             ▼
//! ┌─────────────────────────────────────────────────────────────────────────┐
//! │  ON-CHAIN (This Module)                                                 │
//! │  ┌────────────────────────────────────────────────────────────────────┐ │
//! │  │ ZK Verifier                                                        │ │
//! │  │ 1. Deserialize proof                                               │ │
//! │  │ 2. Validate public inputs                                          │ │
//! │  │ 3. Execute pairing checks (via syscall)                            │ │
//! │  │ 4. Return verification result                                      │ │
//! │  └────────────────────────────────────────────────────────────────────┘ │
//! └─────────────────────────────────────────────────────────────────────────┘
//! ```
//!
//! ## Compute Units
//!
//! ZK proof verification is compute-intensive:
//!
//! | Operation                     | Estimated CU  |
//! |-------------------------------|---------------|
//! | Proof deserialization         | ~5,000        |
//! | Public input validation       | ~2,000        |
//! | Pairing check (via syscall)   | ~150,000      |
//! | Total (funding proof)         | ~200,000      |
//! | Total (validity proof)        | ~300,000      |
//!
//! Note: Full on-chain pairing verification requires the alt_bn128 syscalls
//! or custom implementation. This module provides the scaffolding and
//! delegates heavy computation to Solana native programs when available.
//!
//! ## Integration with SIP Privacy Program
//!
//! The `verify_zk_proof` instruction can be called standalone for testing,
//! or integrated into `shielded_transfer` and `claim_transfer` for
//! production privacy guarantees.

use anchor_lang::prelude::*;

/// Maximum proof size in bytes (UltraHonk proofs are ~2KB)
pub const MAX_PROOF_SIZE: usize = 4096;

/// Maximum number of public inputs
pub const MAX_PUBLIC_INPUTS: usize = 32;

/// Field element size (BN254 scalar field)
pub const FIELD_SIZE: usize = 32;

/// Supported proof types
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ProofType {
    /// Funding proof - proves balance >= minimum
    Funding = 0,
    /// Validity proof - proves intent authorization
    Validity = 1,
    /// Fulfillment proof - proves correct execution
    Fulfillment = 2,
}

impl ProofType {
    /// Get expected number of public inputs for this proof type
    pub fn expected_public_inputs(&self) -> usize {
        match self {
            ProofType::Funding => 3,     // commitment_hash, minimum_required, asset_id
            ProofType::Validity => 6,    // intent_hash, commitment_x, commitment_y, nullifier, timestamp, expiry
            ProofType::Fulfillment => 8, // intent_hash, commitment_x, commitment_y, recipient_stealth, min_output, solver_id, fulfillment_time, expiry
        }
    }

    /// Get human-readable name
    pub fn name(&self) -> &'static str {
        match self {
            ProofType::Funding => "funding",
            ProofType::Validity => "validity",
            ProofType::Fulfillment => "fulfillment",
        }
    }

    /// Try to convert from u8
    pub fn try_from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(ProofType::Funding),
            1 => Some(ProofType::Validity),
            2 => Some(ProofType::Fulfillment),
            _ => None,
        }
    }
}

/// Error types for ZK verification
#[derive(Debug, Clone, PartialEq)]
pub enum ZkVerifyError {
    /// Proof data is too large
    ProofTooLarge,
    /// Invalid proof format
    InvalidProofFormat,
    /// Too many public inputs
    TooManyPublicInputs,
    /// Invalid public input format
    InvalidPublicInput,
    /// Proof verification failed
    VerificationFailed,
    /// Unsupported proof type
    UnsupportedProofType,
    /// Missing public inputs
    MissingPublicInputs,
}

/// Deserialized ZK proof ready for verification
#[derive(Clone, Debug)]
pub struct DeserializedProof {
    /// The proof type
    pub proof_type: ProofType,
    /// Raw proof bytes
    pub proof_bytes: Vec<u8>,
    /// Public inputs as field elements (32 bytes each)
    pub public_inputs: Vec<[u8; FIELD_SIZE]>,
}

/// Verification result with details
#[derive(Clone, Debug)]
pub struct VerificationResult {
    /// Whether the proof is valid
    pub valid: bool,
    /// Proof type that was verified
    pub proof_type: ProofType,
    /// Number of public inputs
    pub public_input_count: usize,
    /// Error message if verification failed
    pub error: Option<String>,
}

/// Deserialize proof from raw bytes
///
/// Expected format:
/// ```text
/// [proof_type: 1 byte]
/// [num_public_inputs: 4 bytes LE]
/// [public_inputs: num_public_inputs * 32 bytes]
/// [proof_len: 4 bytes LE]
/// [proof_bytes: proof_len bytes]
/// ```
pub fn deserialize_proof(data: &[u8]) -> core::result::Result<DeserializedProof, ZkVerifyError> {
    if data.is_empty() {
        return Err(ZkVerifyError::InvalidProofFormat);
    }

    let mut offset = 0;

    // Read proof type (1 byte)
    let proof_type_u8 = data[offset];
    offset += 1;

    let proof_type = ProofType::try_from_u8(proof_type_u8)
        .ok_or(ZkVerifyError::UnsupportedProofType)?;

    // Read number of public inputs (4 bytes LE)
    if data.len() < offset + 4 {
        return Err(ZkVerifyError::InvalidProofFormat);
    }
    let num_inputs = u32::from_le_bytes([
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3],
    ]) as usize;
    offset += 4;

    // Validate public input count
    if num_inputs > MAX_PUBLIC_INPUTS {
        return Err(ZkVerifyError::TooManyPublicInputs);
    }
    if num_inputs < proof_type.expected_public_inputs() {
        return Err(ZkVerifyError::MissingPublicInputs);
    }

    // Read public inputs
    let expected_input_bytes = num_inputs * FIELD_SIZE;
    if data.len() < offset + expected_input_bytes {
        return Err(ZkVerifyError::InvalidProofFormat);
    }

    let mut public_inputs = Vec::with_capacity(num_inputs);
    for _ in 0..num_inputs {
        let mut input = [0u8; FIELD_SIZE];
        input.copy_from_slice(&data[offset..offset + FIELD_SIZE]);
        public_inputs.push(input);
        offset += FIELD_SIZE;
    }

    // Read proof length (4 bytes LE)
    if data.len() < offset + 4 {
        return Err(ZkVerifyError::InvalidProofFormat);
    }
    let proof_len = u32::from_le_bytes([
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3],
    ]) as usize;
    offset += 4;

    // Validate proof size
    if proof_len > MAX_PROOF_SIZE {
        return Err(ZkVerifyError::ProofTooLarge);
    }

    // Read proof bytes
    if data.len() < offset + proof_len {
        return Err(ZkVerifyError::InvalidProofFormat);
    }

    let proof_bytes = data[offset..offset + proof_len].to_vec();

    Ok(DeserializedProof {
        proof_type,
        proof_bytes,
        public_inputs,
    })
}

/// Verify a ZK proof
///
/// ## Current Implementation
///
/// This function performs structural validation of the proof.
/// Full cryptographic verification requires integration with:
///
/// 1. **Sunspot verifiers**: Deploy circuit-specific verifiers via Sunspot
/// 2. **Native syscalls**: Use alt_bn128 precompiles when available
/// 3. **Light Protocol**: Leverage their ZK infrastructure
///
/// ## Production Roadmap
///
/// 1. Format validation (current)
/// 2. Sunspot verifier CPI (next)
/// 3. Native pairing checks (future)
///
/// ## Parameters
///
/// - `proof`: Deserialized proof to verify
///
/// ## Returns
///
/// `VerificationResult` with validity status and details
pub fn verify_proof(proof: &DeserializedProof) -> VerificationResult {
    // Validate proof has minimum required length
    // UltraHonk proofs are typically > 500 bytes
    if proof.proof_bytes.len() < 64 {
        return VerificationResult {
            valid: false,
            proof_type: proof.proof_type,
            public_input_count: proof.public_inputs.len(),
            error: Some("Proof too short".to_string()),
        };
    }

    // Validate public input count matches expected
    let expected_inputs = proof.proof_type.expected_public_inputs();
    if proof.public_inputs.len() < expected_inputs {
        return VerificationResult {
            valid: false,
            proof_type: proof.proof_type,
            public_input_count: proof.public_inputs.len(),
            error: Some(format!(
                "Expected {} public inputs, got {}",
                expected_inputs,
                proof.public_inputs.len()
            )),
        };
    }

    // Validate public inputs are valid field elements (non-zero check)
    for (i, input) in proof.public_inputs.iter().enumerate() {
        // Allow zero values for some inputs but check format
        if !is_valid_field_element(input) {
            return VerificationResult {
                valid: false,
                proof_type: proof.proof_type,
                public_input_count: proof.public_inputs.len(),
                error: Some(format!("Invalid field element at index {}", i)),
            };
        }
    }

    // Log verification attempt
    msg!(
        "ZK proof verification: type={}, inputs={}, proof_size={}",
        proof.proof_type.name(),
        proof.public_inputs.len(),
        proof.proof_bytes.len()
    );

    // TODO: Full cryptographic verification
    //
    // Option 1: CPI to Sunspot verifier program
    // ```rust
    // let verifier_program = get_verifier_program_id(proof.proof_type);
    // let ix = create_sunspot_verify_instruction(proof);
    // invoke(&ix, &[/* accounts */])?;
    // ```
    //
    // Option 2: Native alt_bn128 syscalls (when available)
    // ```rust
    // sol_alt_bn128_pairing_check(/* points */);
    // ```
    //
    // For now, return format validation success
    // The actual cryptographic verification happens:
    // 1. Off-chain via @aztec/bb.js (BrowserNoirProvider)
    // 2. On-chain via Sunspot verifiers (to be integrated)

    VerificationResult {
        valid: true,
        proof_type: proof.proof_type,
        public_input_count: proof.public_inputs.len(),
        error: None,
    }
}

/// Check if bytes represent a valid BN254 field element
///
/// A valid field element must be < curve order:
/// r = 21888242871839275222246405745257275088548364400416034343698204186575808495617
///
/// For simplicity, we just check the high byte isn't > 0x30
/// (actual curve order is ~2^254, so high byte < 0x31)
fn is_valid_field_element(bytes: &[u8; FIELD_SIZE]) -> bool {
    // BN254 curve order is approximately 2^254
    // So the highest byte should be < 0x31 for valid elements
    bytes[0] < 0x31
}

/// Verify a funding proof specifically
///
/// Funding proofs demonstrate:
/// - balance >= minimum_required
/// - Commitment matches declared balance
///
/// Public inputs:
/// 1. commitment_hash - Hash of the Pedersen commitment
/// 2. minimum_required - Minimum balance to prove
/// 3. asset_id - Asset identifier being proven
pub fn verify_funding_proof(
    proof_bytes: &[u8],
    commitment_hash: [u8; FIELD_SIZE],
    minimum_required: [u8; FIELD_SIZE],
    asset_id: [u8; FIELD_SIZE],
) -> core::result::Result<bool, ZkVerifyError> {
    // Build proof structure
    let proof = DeserializedProof {
        proof_type: ProofType::Funding,
        proof_bytes: proof_bytes.to_vec(),
        public_inputs: vec![commitment_hash, minimum_required, asset_id],
    };

    let result = verify_proof(&proof);

    if result.valid {
        Ok(true)
    } else {
        msg!("Funding proof verification failed: {:?}", result.error);
        Err(ZkVerifyError::VerificationFailed)
    }
}

/// Verify a validity proof specifically
///
/// Validity proofs demonstrate:
/// - Sender authorized this intent
/// - Nullifier is correctly derived
/// - Intent hasn't expired
///
/// Public inputs:
/// 1. intent_hash - Hash of the intent
/// 2. sender_commitment_x - X coordinate of sender commitment
/// 3. sender_commitment_y - Y coordinate of sender commitment
/// 4. nullifier - Prevents replay
/// 5. timestamp - Current time
/// 6. expiry - Intent expiration time
pub fn verify_validity_proof(
    proof_bytes: &[u8],
    intent_hash: [u8; FIELD_SIZE],
    sender_commitment: ([u8; FIELD_SIZE], [u8; FIELD_SIZE]),
    nullifier: [u8; FIELD_SIZE],
    timestamp: u64,
    expiry: u64,
) -> core::result::Result<bool, ZkVerifyError> {
    // Convert timestamps to field elements
    let mut timestamp_bytes = [0u8; FIELD_SIZE];
    timestamp_bytes[24..32].copy_from_slice(&timestamp.to_be_bytes());

    let mut expiry_bytes = [0u8; FIELD_SIZE];
    expiry_bytes[24..32].copy_from_slice(&expiry.to_be_bytes());

    let proof = DeserializedProof {
        proof_type: ProofType::Validity,
        proof_bytes: proof_bytes.to_vec(),
        public_inputs: vec![
            intent_hash,
            sender_commitment.0,
            sender_commitment.1,
            nullifier,
            timestamp_bytes,
            expiry_bytes,
        ],
    };

    let result = verify_proof(&proof);

    if result.valid {
        Ok(true)
    } else {
        msg!("Validity proof verification failed: {:?}", result.error);
        Err(ZkVerifyError::VerificationFailed)
    }
}

/// Verification key storage account
///
/// Stores the verification key for a specific circuit type.
/// Keys are loaded from compiled circuit artifacts and stored on-chain
/// for efficient verification.
#[derive(Clone, Debug)]
pub struct VerificationKeyAccount {
    /// Circuit type this key is for
    pub circuit_type: ProofType,
    /// Verification key bytes
    pub key_bytes: Vec<u8>,
    /// Key hash for integrity verification
    pub key_hash: [u8; 32],
    /// Number of public inputs expected
    pub public_input_count: u8,
    /// Authority that can update the key
    pub authority: [u8; 32],
    /// PDA bump
    pub bump: u8,
}

/// Compute units estimate by proof type
///
/// These are conservative estimates for compute budget planning.
pub fn estimate_compute_units(proof_type: ProofType) -> u32 {
    match proof_type {
        // Funding proof: ~2K constraints, simpler verification
        ProofType::Funding => 200_000,
        // Validity proof: ~72K constraints, includes ECDSA
        ProofType::Validity => 350_000,
        // Fulfillment proof: ~22K constraints
        ProofType::Fulfillment => 250_000,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proof_type_from_u8() {
        assert_eq!(ProofType::try_from_u8(0), Some(ProofType::Funding));
        assert_eq!(ProofType::try_from_u8(1), Some(ProofType::Validity));
        assert_eq!(ProofType::try_from_u8(2), Some(ProofType::Fulfillment));
        assert_eq!(ProofType::try_from_u8(3), None);
        assert_eq!(ProofType::try_from_u8(255), None);
    }

    #[test]
    fn test_expected_public_inputs() {
        assert_eq!(ProofType::Funding.expected_public_inputs(), 3);
        assert_eq!(ProofType::Validity.expected_public_inputs(), 6);
        assert_eq!(ProofType::Fulfillment.expected_public_inputs(), 8);
    }

    #[test]
    fn test_valid_field_element() {
        // Valid field element (small value)
        let valid = [0u8; 32];
        assert!(is_valid_field_element(&valid));

        // Valid field element (large but valid)
        let mut large_valid = [0u8; 32];
        large_valid[0] = 0x30;
        assert!(is_valid_field_element(&large_valid));

        // Invalid (too large)
        let mut invalid = [0u8; 32];
        invalid[0] = 0x40;
        assert!(!is_valid_field_element(&invalid));
    }

    #[test]
    fn test_deserialize_proof_format() {
        // Create a minimal valid proof
        let mut data = Vec::new();

        // Proof type (funding = 0)
        data.push(0);

        // Number of public inputs (3 for funding)
        data.extend_from_slice(&3u32.to_le_bytes());

        // Public inputs (3 * 32 bytes)
        for _ in 0..3 {
            data.extend_from_slice(&[0u8; 32]);
        }

        // Proof length (100 bytes)
        data.extend_from_slice(&100u32.to_le_bytes());

        // Proof bytes (100 bytes of zeros)
        data.extend_from_slice(&[0u8; 100]);

        let result = deserialize_proof(&data);
        assert!(result.is_ok());

        let proof = result.unwrap();
        assert_eq!(proof.proof_type, ProofType::Funding);
        assert_eq!(proof.public_inputs.len(), 3);
        assert_eq!(proof.proof_bytes.len(), 100);
    }

    #[test]
    fn test_deserialize_invalid_proof_type() {
        let mut data = Vec::new();
        data.push(99); // Invalid proof type
        data.extend_from_slice(&3u32.to_le_bytes());

        let result = deserialize_proof(&data);
        assert!(matches!(result, Err(ZkVerifyError::UnsupportedProofType)));
    }

    #[test]
    fn test_deserialize_too_many_inputs() {
        let mut data = Vec::new();
        data.push(0); // Funding
        data.extend_from_slice(&100u32.to_le_bytes()); // Too many inputs

        let result = deserialize_proof(&data);
        assert!(matches!(result, Err(ZkVerifyError::TooManyPublicInputs)));
    }

    #[test]
    fn test_verify_proof_too_short() {
        let proof = DeserializedProof {
            proof_type: ProofType::Funding,
            proof_bytes: vec![0u8; 10], // Too short
            public_inputs: vec![[0u8; 32]; 3],
        };

        let result = verify_proof(&proof);
        assert!(!result.valid);
        assert!(result.error.is_some());
    }

    #[test]
    fn test_verify_proof_missing_inputs() {
        let proof = DeserializedProof {
            proof_type: ProofType::Funding,
            proof_bytes: vec![0u8; 100],
            public_inputs: vec![[0u8; 32]; 1], // Only 1, need 3
        };

        let result = verify_proof(&proof);
        assert!(!result.valid);
    }

    #[test]
    fn test_estimate_compute_units() {
        assert!(estimate_compute_units(ProofType::Funding) > 0);
        assert!(estimate_compute_units(ProofType::Validity) > estimate_compute_units(ProofType::Funding));
    }
}
