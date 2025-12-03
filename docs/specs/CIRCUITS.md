# Circuit Artifacts

This document describes the SIP Protocol's Noir circuit artifacts and the process for updating them.

## Overview

SIP Protocol uses three ZK circuits implemented in Noir:

| Circuit | Purpose | Location |
|---------|---------|----------|
| **funding_proof** | Proves sufficient balance without revealing actual amount | `packages/sdk/src/proofs/circuits/funding_proof.json` |
| **validity_proof** | Proves intent authorization without revealing sender | `packages/sdk/src/proofs/circuits/validity_proof.json` |
| **fulfillment_proof** | Proves correct execution without revealing execution path | `packages/sdk/src/proofs/circuits/fulfillment_proof.json` |

## Circuit Validation

Circuits are validated in CI using the `validate-circuits` job. The validation checks:

1. **File exists** - Circuit JSON file is present
2. **Valid JSON** - File parses as valid JSON
3. **Required fields** - Contains `noir_version`, `hash`, `abi`, `bytecode`
4. **ABI parameters** - Expected parameters are present
5. **Bytecode validity** - Bytecode is non-empty

### Running Validation Locally

```bash
node scripts/validate-circuits.js
```

## Updating Circuit Artifacts

When updating circuits, follow this process:

### 1. Update Circuit Source

Circuits are developed in the [circuits repository](https://github.com/sip-protocol/circuits). Make changes there first.

```bash
# In circuits repo
cd packages/circuits/<circuit_name>
nargo compile
nargo test
```

### 2. Export Compiled Artifacts

After successful compilation:

```bash
# Copy the compiled JSON to SDK
cp target/<circuit_name>.json ../sip-protocol/packages/sdk/src/proofs/circuits/<circuit_name>.json
```

### 3. Update Validation Script (if needed)

If circuit parameters change, update `scripts/validate-circuits.js`:

```javascript
const CIRCUITS = [
  {
    name: 'circuit_name',
    path: 'packages/sdk/src/proofs/circuits/circuit_name.json',
    requiredParams: ['param1', 'param2', ...],  // Update this
  },
]
```

### 4. Run Validation

```bash
node scripts/validate-circuits.js
```

### 5. Update SDK Proof Provider (if needed)

If circuit inputs/outputs change, update the corresponding proof provider in:
- `packages/sdk/src/proofs/noir-provider.ts`

### 6. Run Tests

```bash
pnpm test -- --run
```

## Circuit JSON Structure

Each circuit JSON file contains:

```json
{
  "noir_version": "1.0.0-beta.15+...",
  "hash": "17105369051450454041",
  "abi": {
    "parameters": [
      {
        "name": "param_name",
        "type": { "kind": "field" },
        "visibility": "public"
      }
    ],
    "return_type": null,
    "error_types": {}
  },
  "bytecode": "H4sIAAAAAAAA/...",
  "debug_symbols": "...",
  "file_map": {}
}
```

### Key Fields

| Field | Description |
|-------|-------------|
| `noir_version` | Noir compiler version used |
| `hash` | Circuit hash for verification |
| `abi.parameters` | Input parameters with types and visibility |
| `bytecode` | Compressed ACIR bytecode |

## Current Circuit Parameters

### funding_proof

| Parameter | Type | Visibility |
|-----------|------|------------|
| `commitment_hash` | Field | public |
| `minimum_required` | u64 | public |
| `asset_id` | Field | public |
| `balance` | u64 | private |
| `blinding` | Field | private |

### validity_proof

| Parameter | Type | Visibility |
|-----------|------|------------|
| `intent_hash` | Field | public |
| `sender_commitment_x` | Field | public |
| `sender_commitment_y` | Field | public |
| `nullifier` | Field | public |
| `timestamp` | u64 | public |
| `expiry` | u64 | public |
| `sender_address` | Field | private |
| `sender_blinding` | Field | private |
| `sender_secret` | Field | private |
| `pub_key_x` | [u8; 32] | private |
| `pub_key_y` | [u8; 32] | private |
| `signature` | [u8; 64] | private |
| `message_hash` | [u8; 32] | private |
| `nonce` | Field | private |

### fulfillment_proof

| Parameter | Type | Visibility |
|-----------|------|------------|
| `intent_hash` | Field | public |
| `output_commitment_x` | Field | public |
| `output_commitment_y` | Field | public |
| `recipient_stealth` | Field | public |
| `min_output_amount` | u64 | public |
| `solver_id` | Field | public |
| `fulfillment_time` | u64 | public |
| `expiry` | u64 | public |
| `output_amount` | u64 | private |
| `output_blinding` | Field | private |
| `solver_secret` | Field | private |
| `attestation_*` | various | private |
| `oracle_*` | various | private |

## Troubleshooting

### Validation Fails

1. **Missing parameter**: Check if circuit source was updated but not the validation script
2. **Invalid JSON**: Re-compile the circuit with `nargo compile`
3. **File not found**: Ensure the path in `validate-circuits.js` matches

### Proof Generation Fails

1. **Type mismatch**: Ensure SDK input types match circuit ABI types
2. **Version mismatch**: Check `noir_version` matches the SDK's expected version
3. **Bytecode invalid**: Re-export the circuit JSON from a fresh compilation

## Related Documentation

- [Funding Proof Spec](./FUNDING-PROOF.md)
- [Validity Proof Spec](./VALIDITY-PROOF.md)
- [Fulfillment Proof Spec](./FULFILLMENT-PROOF.md)
- [Noir Documentation](https://noir-lang.org/docs/)
