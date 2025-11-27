/// Funding Proof Circuit
///
/// Proves: "I have sufficient funds to fulfill this intent, without revealing
/// my exact balance, wallet address, or source of funds."
///
/// @see docs/specs/FUNDING-PROOF.md

use std::hash::pedersen_hash;
use std::hash::pedersen_commitment;

// --- Main Circuit ---

/// Main funding proof entry point
///
/// Public inputs: commitment_hash, minimum_required, asset_id
/// Private inputs: balance, blinding
///
/// Constraints:
/// 1. balance >= minimum_required (range proof via u64)
/// 2. commitment = Pedersen(balance, blinding)
/// 3. hash(commitment, asset_id) == commitment_hash
pub fn main(
    commitment_hash: pub Field,
    minimum_required: pub u64,
    asset_id: pub Field,
    balance: u64,
    blinding: Field,
) {
    // Constraint 1: Sufficient Funds
    assert(balance >= minimum_required, "Insufficient balance");
    
    // Constraint 2: Compute Pedersen Commitment
    // Uses Noir's built-in pedersen_commitment which returns (x, y) point
    let commitment = pedersen_commitment([balance as Field, blinding]);
    
    // Constraint 3: Verify Commitment Hash
    let computed_hash = pedersen_hash([commitment.x, commitment.y, asset_id]);
    assert(computed_hash == commitment_hash, "Commitment hash mismatch");
}

// --- Tests ---

#[test]
fn test_valid_funding_proof() {
    let balance: u64 = 100;
    let minimum_required: u64 = 50;
    let blinding: Field = 12345;
    let asset_id: Field = 0xABCD;

    // Compute commitment using same method as circuit
    let commitment = pedersen_commitment([balance as Field, blinding]);
    let commitment_hash = pedersen_hash([commitment.x, commitment.y, asset_id]);

    // This should pass
    main(commitment_hash, minimum_required, asset_id, balance, blinding);
}

#[test(should_fail_with = "Insufficient balance")]
fn test_insufficient_balance() {
    let balance: u64 = 50;
    let minimum_required: u64 = 100;
    let blinding: Field = 12345;
    let asset_id: Field = 0xABCD;

    let commitment = pedersen_commitment([balance as Field, blinding]);
    let commitment_hash = pedersen_hash([commitment.x, commitment.y, asset_id]);

    // This should fail - balance < minimum
    main(commitment_hash, minimum_required, asset_id, balance, blinding);
}

#[test(should_fail_with = "Commitment hash mismatch")]
fn test_wrong_commitment_hash() {
    let balance: u64 = 100;
    let minimum_required: u64 = 50;
    let blinding: Field = 12345;
    let asset_id: Field = 0xABCD;
    let wrong_hash: Field = 0xDEADBEEF;

    // This should fail - wrong hash
    main(wrong_hash, minimum_required, asset_id, balance, blinding);
}

#[test(should_fail_with = "Commitment hash mismatch")]
fn test_wrong_blinding() {
    let balance: u64 = 100;
    let minimum_required: u64 = 50;
    let correct_blinding: Field = 12345;
    let wrong_blinding: Field = 54321;
    let asset_id: Field = 0xABCD;

    // Compute hash with correct blinding
    let commitment = pedersen_commitment([balance as Field, correct_blinding]);
    let commitment_hash = pedersen_hash([commitment.x, commitment.y, asset_id]);

    // Try to prove with wrong blinding - should fail
    main(commitment_hash, minimum_required, asset_id, balance, wrong_blinding);
}
