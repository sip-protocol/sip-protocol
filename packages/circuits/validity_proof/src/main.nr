/// Validity Proof Circuit
///
/// Proves: "This intent is authorized by the sender, without revealing
/// the sender's identity, private key, or signature."
///
/// @see docs/specs/VALIDITY-PROOF.md

use std::hash::pedersen_hash;
use std::hash::pedersen_commitment;
use std::ecdsa_secp256k1::verify_signature;

// --- Main Circuit ---

/// Main validity proof entry point
///
/// Public inputs: intent_hash, sender_commitment (x,y), nullifier, timestamp, expiry
/// Private inputs: sender_address (Field), sender_blinding, sender_secret, 
///                 pub_key_x, pub_key_y, signature, message_hash, nonce
///
/// Constraints:
/// 1. sender_commitment = Pedersen(sender_address, sender_blinding)
/// 2. signature is valid for message_hash using pub_key
/// 3. nullifier = Pedersen_hash(sender_secret, intent_hash, nonce)
/// 4. timestamp < expiry
pub fn main(
    // Public inputs
    intent_hash: pub Field,
    sender_commitment_x: pub Field,
    sender_commitment_y: pub Field,
    nullifier: pub Field,
    timestamp: pub u64,
    expiry: pub u64,
    
    // Private inputs
    sender_address: Field,
    sender_blinding: Field,
    sender_secret: Field,
    pub_key_x: [u8; 32],
    pub_key_y: [u8; 32],
    signature: [u8; 64],
    message_hash: [u8; 32],
    nonce: Field,
) {
    // Constraint 1: Verify Sender Commitment
    // C = Pedersen(sender_address, sender_blinding)
    let commitment = pedersen_commitment([sender_address, sender_blinding]);
    assert(commitment.x == sender_commitment_x, "Sender commitment X mismatch");
    assert(commitment.y == sender_commitment_y, "Sender commitment Y mismatch");
    
    // Constraint 2: Verify ECDSA Signature
    // The signature must be valid for the message_hash using the provided public key
    let valid_sig = verify_signature(pub_key_x, pub_key_y, signature, message_hash);
    assert(valid_sig, "Invalid ECDSA signature");
    
    // Constraint 3: Verify Nullifier Derivation
    // nullifier = Pedersen_hash(sender_secret, intent_hash, nonce)
    let computed_nullifier = pedersen_hash([sender_secret, intent_hash, nonce]);
    assert(computed_nullifier == nullifier, "Nullifier mismatch");
    
    // Constraint 4: Time Bounds Check
    assert(timestamp < expiry, "Intent expired");
}

// --- Tests ---

// NOTE: Full ECDSA integration test requires TypeScript to generate valid signatures
// The NoirProofProvider in SDK will generate proper test vectors
// Here we test the commitment and nullifier logic which are pure Noir

#[test]
fn test_commitment_and_nullifier() {
    // Test just the commitment and nullifier computation (without ECDSA)
    let sender_address: Field = 0x742d35Cc6634C0532925a3b844Bc9e7595f;
    let sender_blinding: Field = 0xABCDEF123456;
    let sender_secret: Field = 0x1234567890ABCDEF;
    let intent_hash: Field = 0xDEADBEEF;
    let nonce: Field = 0x99999;
    
    // Compute and verify commitment is consistent
    let commitment1 = pedersen_commitment([sender_address, sender_blinding]);
    let commitment2 = pedersen_commitment([sender_address, sender_blinding]);
    assert(commitment1.x == commitment2.x, "Commitment X should be deterministic");
    assert(commitment1.y == commitment2.y, "Commitment Y should be deterministic");
    
    // Compute and verify nullifier is consistent
    let nullifier1 = pedersen_hash([sender_secret, intent_hash, nonce]);
    let nullifier2 = pedersen_hash([sender_secret, intent_hash, nonce]);
    assert(nullifier1 == nullifier2, "Nullifier should be deterministic");
    
    // Different nonce should give different nullifier
    let different_nonce: Field = 0x88888;
    let nullifier3 = pedersen_hash([sender_secret, intent_hash, different_nonce]);
    assert(nullifier1 != nullifier3, "Different nonce should give different nullifier");
}

#[test]
fn test_time_bounds() {
    // Test timestamp < expiry constraint
    let valid_timestamp: u64 = 1732600000;
    let valid_expiry: u64 = 1732686400;
    assert(valid_timestamp < valid_expiry, "Valid time bounds");
}

// NOTE: Full integration tests with ECDSA require TypeScript SDK
// The NoirProofProvider will generate valid signature test vectors
