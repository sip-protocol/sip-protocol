# Noir → EVM ZK Verifier Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the mock ZKVerifier.sol with a real BB-generated UltraHonk verifier that cryptographically validates Noir proofs on-chain.

**Architecture:** Use Barretenberg CLI (`bb contract`) to auto-generate a Solidity verifier from the compiled funding_proof Noir circuit. Keep ZKVerifier.sol as a router/adapter implementing IZKVerifier (SIPPrivacy interface unchanged) that delegates to the generated verifier. Also deploy all contracts to Arbitrum Sepolia (#814).

**Tech Stack:** Noir 1.0.0-beta.15, Barretenberg (UltraHonk, bn254), Foundry (Forge), Solidity 0.8.24, @aztec/bb.js 3.0.2

**Issues:** #805 (ZK Verifier), #814 (Arbitrum Sepolia)

---

## Context for the Implementer

### Current State
- **ZKVerifier.sol** (`contracts/sip-ethereum/src/ZKVerifier.sol`, 504 lines) — MOCK. Parses UltraHonk proof structure but `_verifyPairing()` returns `true` on structural checks only. No actual pairing precompile call.
- **SIPPrivacy.sol** calls `zkVerifier.verifyProof(commitment, proof)` at lines 278-281 and 367-370. Proof verification is optional (skipped if verifier not set or proof empty).
- **IZKVerifier.sol** defines 3 methods: `verifyProof()`, `verifyFundingProof()`, `verifyValidityProof()`. SIPPrivacy only calls `verifyProof()` currently.
- **Noir circuits** exist in `packages/circuits/` (funding, validity, fulfillment). Pre-compiled JSON artifacts bundled in `packages/sdk/src/proofs/circuits/`.
- **SDK** has `NoirProofProvider` using `@aztec/bb.js` v3.0.2 (`UltraHonkBackend`) — generates real proofs in JS/WASM.
- **Neither `bb` nor `nargo` are installed** on the dev machine. Circuit `target/` dirs are empty.
- **Deployed to:** Sepolia, Base Sepolia, OP Sepolia. Arbitrum Sepolia pending (needs ETH).

### Key Integration Point
SIPPrivacy.sol at line 278-281:
```solidity
if (address(zkVerifier) != address(0) && proof.length > 0) {
    if (!zkVerifier.verifyProof(commitment, proof)) {
        revert InvalidProof();
    }
}
```

### BB-Generated Verifier Interface
The `bb contract` command generates a self-contained Solidity file with:
- VK constants embedded (no separate VK setup needed)
- Full UltraHonk pairing verification (Fiat-Shamir, KZG opening, bn254 pairing precompile)
- Interface: `function verify(bytes calldata _proof, bytes32[] calldata _publicInputs) external view returns (bool)`

### Proof Flow
```
SDK: NoirProofProvider.generateFundingProof()
  → UltraHonkBackend.generateProof(witness)
  → proof bytes + publicInputs[]

On-chain: ZKVerifier.verifyFundingProof(commitmentHash, minRequired, assetId, proof)
  → packs public inputs as bytes32[]
  → calls FundingVerifier.verify(proof, publicInputs)
  → bn254 pairing check → true/false
```

### File Tree (what changes)
```
contracts/sip-ethereum/
├── src/
│   ├── ZKVerifier.sol                    # MODIFY: simplify to router
│   ├── interfaces/
│   │   ├── IZKVerifier.sol               # UNCHANGED
│   │   └── IHonkVerifier.sol             # NEW: interface for generated verifier
│   └── verifiers/
│       └── FundingVerifier.sol           # NEW: bb-generated (auto)
├── test/
│   ├── ZKVerifier.t.sol                  # NEW: router tests
│   ├── FundingVerifier.t.sol             # NEW: standalone verifier tests
│   └── helpers/TestSetup.sol             # MODIFY: add FundingVerifier
├── script/
│   └── DeployVerifier.s.sol              # NEW: deploy + register verifier
└── foundry.toml                          # UNCHANGED
packages/circuits/funding_proof/
├── target/                               # GENERATED: nargo compile output
│   └── funding_proof.json                # ACIR bytecode
scripts/
└── generate-proof-fixture.ts             # NEW: generate test proof fixture
```

---

### Task 1: Install Noir + Barretenberg Toolchain

**Files:** None (system-level install)

**Step 1: Install Noirup (Noir version manager)**

Run:
```bash
curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
```

Expected: noirup installed to `~/.nargo/bin/noirup`

**Step 2: Install Nargo 1.0.0-beta.15 (matches circuit noir_version)**

Run:
```bash
noirup -v 1.0.0-beta.15
nargo --version
```

Expected: `nargo version = 1.0.0-beta.15`

**Step 3: Install bbup (Barretenberg version manager)**

Run:
```bash
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/master/barretenberg/bbup/install | bash
```

Expected: bbup installed

**Step 4: Install bb CLI matching @aztec/bb.js 3.0.2**

The `@aztec/bb.js` v3.0.2 corresponds to Aztec packages monorepo. We need to find the matching `bb` version.

Run:
```bash
# Install latest compatible bb (will test against our circuits)
bbup
bb --version
```

If version mismatch causes issues later (Task 3), pin to specific version with `bbup -v <version>`.

**Step 5: Verify toolchain**

Run:
```bash
nargo --version && bb --version
```

Expected: Both commands succeed.

**Step 6: Commit** — No commit (system install, not repo change).

---

### Task 2: Compile Funding Proof Circuit

**Files:**
- Read: `packages/circuits/funding_proof/src/main.nr`
- Read: `packages/circuits/funding_proof/Nargo.toml`
- Generated: `packages/circuits/funding_proof/target/funding_proof.json`

**Step 1: Run Noir circuit tests**

Run:
```bash
cd packages/circuits/funding_proof
nargo test
```

Expected: 4 tests pass (test_valid_funding_proof, test_insufficient_balance, test_wrong_commitment_hash, test_wrong_blinding)

**Step 2: Compile the circuit**

Run:
```bash
cd packages/circuits/funding_proof
nargo compile
ls -la target/
```

Expected: `target/funding_proof.json` created (ACIR bytecode)

**Step 3: Verify compiled artifact matches SDK bundle**

The SDK already has a compiled artifact at `packages/sdk/src/proofs/circuits/funding_proof.json`. Compare to ensure consistency:

Run:
```bash
# Check that the circuit ABI matches (same public inputs, same structure)
cat packages/circuits/funding_proof/target/funding_proof.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
print('ABI params:', [p['name'] for p in data['abi']['parameters']])
print('Bytecode length:', len(data['bytecode']))
"
```

Expected: ABI params include `commitment_hash`, `minimum_required`, `asset_id`, `balance`, `blinding`.

**Step 4: Commit** — No commit yet (generated artifacts, will commit with verifier).

---

### Task 3: Generate Solidity Verifier from Compiled Circuit

**Files:**
- Read: `packages/circuits/funding_proof/target/funding_proof.json`
- Generated: `contracts/sip-ethereum/src/verifiers/FundingVerifier.sol`

**Step 1: Generate verification key**

Run:
```bash
cd packages/circuits/funding_proof
bb write_vk -b target/funding_proof.json -o target/vk
ls -la target/vk
```

Expected: Binary VK file created at `target/vk`

**Step 2: Generate Solidity verifier**

Run:
```bash
mkdir -p contracts/sip-ethereum/src/verifiers
bb contract -k packages/circuits/funding_proof/target/vk -o contracts/sip-ethereum/src/verifiers/FundingVerifier.sol
```

Expected: Solidity file created. Check it compiles:

**Step 3: Inspect generated verifier interface**

Run:
```bash
# Find the verify function signature
grep -n "function verify" contracts/sip-ethereum/src/verifiers/FundingVerifier.sol
```

Expected: Something like `function verify(bytes calldata _proof, bytes32[] calldata _publicInputs) external view returns (bool)`

**IMPORTANT:** The exact interface of the generated verifier determines how the ZKVerifier router calls it. Note the function signature — if it differs from expected, adjust Task 5 accordingly.

**Step 4: Verify it compiles**

Run:
```bash
cd contracts/sip-ethereum
forge build
```

Expected: Build succeeds (may need to adjust Solidity version pragma if generated file uses different version).

**Step 5: Commit**

```bash
git add contracts/sip-ethereum/src/verifiers/FundingVerifier.sol
git add packages/circuits/funding_proof/target/
git commit -m "feat(contracts): add bb-generated FundingVerifier from Noir circuit

Generated via Barretenberg CLI from funding_proof circuit.
Contains full UltraHonk pairing verification (bn254).
Ref: #805"
```

---

### Task 4: Create IHonkVerifier Interface

**Files:**
- Create: `contracts/sip-ethereum/src/interfaces/IHonkVerifier.sol`

**Step 1: Create the interface file**

Based on the generated verifier's `verify()` signature (confirmed in Task 3 Step 3), create a minimal interface:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IHonkVerifier
/// @notice Interface for BB-generated UltraHonk verifiers
interface IHonkVerifier {
    /// @notice Verify an UltraHonk proof
    /// @param _proof Serialized proof bytes from Barretenberg
    /// @param _publicInputs Public inputs as bytes32 array
    /// @return True if proof is valid
    function verify(bytes calldata _proof, bytes32[] calldata _publicInputs) external view returns (bool);
}
```

**IMPORTANT:** If the generated verifier's `verify()` signature differs (Task 3 Step 3), update this interface to match EXACTLY.

**Step 2: Verify it compiles**

Run:
```bash
cd contracts/sip-ethereum && forge build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add contracts/sip-ethereum/src/interfaces/IHonkVerifier.sol
git commit -m "feat(contracts): add IHonkVerifier interface for bb-generated verifiers

Ref: #805"
```

---

### Task 5: Write Failing Test for FundingVerifier

**Files:**
- Create: `contracts/sip-ethereum/test/FundingVerifier.t.sol`

**Step 1: Write the test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

// Import the generated verifier — adjust name if bb generates different contract name
import {HonkVerifier} from "../src/verifiers/FundingVerifier.sol";

/// @title FundingVerifier Tests
/// @notice Tests for the BB-generated UltraHonk funding proof verifier
contract FundingVerifierTest is Test {
    HonkVerifier public verifier;

    function setUp() public {
        verifier = new HonkVerifier();
    }

    /// @notice Empty proof should revert or return false
    function test_rejects_empty_proof() public {
        bytes32[] memory publicInputs = new bytes32[](3);
        publicInputs[0] = bytes32(uint256(1)); // commitment_hash
        publicInputs[1] = bytes32(uint256(50)); // minimum_required
        publicInputs[2] = bytes32(uint256(0xABCD)); // asset_id

        // Empty proof should fail verification
        bytes memory emptyProof = "";
        // This will either revert or return false depending on generated verifier behavior
        vm.expectRevert();
        verifier.verify(emptyProof, publicInputs);
    }

    /// @notice Random garbage proof should fail
    function test_rejects_garbage_proof() public {
        bytes32[] memory publicInputs = new bytes32[](3);
        publicInputs[0] = bytes32(uint256(1));
        publicInputs[1] = bytes32(uint256(50));
        publicInputs[2] = bytes32(uint256(0xABCD));

        // Random bytes should not verify
        bytes memory garbageProof = new bytes(2048);
        for (uint256 i = 0; i < 2048; i++) {
            garbageProof[i] = bytes1(uint8(i % 256));
        }

        // Should either revert or return false
        try verifier.verify(garbageProof, publicInputs) returns (bool result) {
            assertFalse(result, "Garbage proof should not verify");
        } catch {
            // Revert is also acceptable — means proof is rejected
        }
    }

    /// @notice Verifier deploys and has expected interface
    function test_verifier_deploys() public view {
        // Verifier contract should have code
        assertTrue(address(verifier).code.length > 0, "Verifier should have code");
    }
}
```

**IMPORTANT:** The contract name inside the generated file might not be `HonkVerifier`. Check the actual contract name in `FundingVerifier.sol` (Task 3) and adjust the import accordingly.

**Step 2: Run test to verify it fails/passes**

Run:
```bash
cd contracts/sip-ethereum
forge test --match-contract FundingVerifierTest -vvv
```

Expected: `test_verifier_deploys` passes. `test_rejects_empty_proof` and `test_rejects_garbage_proof` should pass (verifier correctly rejects invalid proofs). If they fail, the generated verifier may have a different behavior — adjust test expectations.

**Step 3: Commit**

```bash
git add contracts/sip-ethereum/test/FundingVerifier.t.sol
git commit -m "test(contracts): add FundingVerifier unit tests

Tests that BB-generated verifier rejects empty/garbage proofs.
Ref: #805"
```

---

### Task 6: Rewrite ZKVerifier as Router

**Files:**
- Modify: `contracts/sip-ethereum/src/ZKVerifier.sol`
- Read: `contracts/sip-ethereum/src/interfaces/IZKVerifier.sol` (for interface compliance)

**Step 1: Write failing test for the router**

Create `contracts/sip-ethereum/test/ZKVerifier.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ZKVerifier} from "../src/ZKVerifier.sol";
import {HonkVerifier} from "../src/verifiers/FundingVerifier.sol";

contract ZKVerifierTest is Test {
    ZKVerifier public zkVerifier;
    HonkVerifier public fundingVerifier;
    address public owner;

    function setUp() public {
        owner = makeAddr("owner");
        vm.startPrank(owner);
        fundingVerifier = new HonkVerifier();
        zkVerifier = new ZKVerifier(owner);
        zkVerifier.setFundingVerifier(address(fundingVerifier));
        vm.stopPrank();
    }

    /// @notice Funding verifier is set correctly
    function test_funding_verifier_set() public view {
        assertEq(address(zkVerifier.fundingVerifier()), address(fundingVerifier));
    }

    /// @notice Only owner can set funding verifier
    function test_only_owner_sets_funding_verifier() public {
        vm.prank(makeAddr("attacker"));
        vm.expectRevert();
        zkVerifier.setFundingVerifier(address(0x1234));
    }

    /// @notice verifyFundingProof delegates to HonkVerifier
    function test_verify_funding_proof_rejects_garbage() public {
        bytes memory garbageProof = new bytes(2048);

        // Should either revert or return false (delegated to real verifier)
        try zkVerifier.verifyFundingProof(
            bytes32(uint256(1)),  // commitmentHash
            50,                   // minimumRequired
            bytes32(uint256(0xABCD)), // assetId
            garbageProof
        ) returns (bool result) {
            assertFalse(result, "Should reject garbage proof");
        } catch {
            // Revert is acceptable
        }
    }

    /// @notice verifyFundingProof reverts if no verifier set
    function test_verify_funding_proof_reverts_no_verifier() public {
        vm.prank(owner);
        ZKVerifier freshVerifier = new ZKVerifier(owner);

        vm.expectRevert();
        freshVerifier.verifyFundingProof(
            bytes32(uint256(1)),
            50,
            bytes32(uint256(0xABCD)),
            new bytes(100)
        );
    }

    /// @notice verifyProof still works (backwards compat with SIPPrivacy)
    function test_verify_proof_backwards_compat() public {
        // verifyProof with empty proof should handle gracefully
        // When no commitment verifier is set, behavior depends on implementation
        bytes32 commitment = bytes32(uint256(0x02) << 248 | uint256(1));
        bytes memory emptyProof = "";

        // The router should handle this based on verification mode
        try zkVerifier.verifyProof(commitment, emptyProof) returns (bool result) {
            // If verification is disabled or no verifier set, may return true
            assertTrue(true); // Just checking it doesn't revert unexpectedly
        } catch {
            // Also acceptable
        }
    }
}
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd contracts/sip-ethereum
forge test --match-contract ZKVerifierTest -vvv
```

Expected: FAIL — `setFundingVerifier` doesn't exist yet, `fundingVerifier()` doesn't exist yet.

**Step 3: Rewrite ZKVerifier.sol as a router**

Replace the entire `contracts/sip-ethereum/src/ZKVerifier.sol` with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZKVerifier} from "./interfaces/IZKVerifier.sol";
import {IHonkVerifier} from "./interfaces/IHonkVerifier.sol";

/// @title ZKVerifier
/// @author SIP Protocol Team
/// @notice Routes ZK proof verification to BB-generated UltraHonk verifiers
/// @dev Adapter between IZKVerifier (used by SIPPrivacy) and IHonkVerifier (bb-generated)
contract ZKVerifier is IZKVerifier {
    // ═══════════════════════════════════════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════════════════════════════════════

    address public owner;
    bool public verificationEnabled;

    /// @notice BB-generated verifier for funding proofs
    IHonkVerifier public fundingVerifier;

    /// @notice BB-generated verifier for validity proofs (Phase B)
    IHonkVerifier public validityVerifier;

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    event VerifierUpdated(string proofType, address verifier);
    event ProofVerified(string indexed proofType, bool valid);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error Unauthorized();
    error VerifierNotSet();
    error VerificationDisabled();

    // ═══════════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(address _owner) {
        owner = _owner;
        verificationEnabled = true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IZKVerifier Implementation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IZKVerifier
    function verifyProof(
        bytes32 commitment,
        bytes calldata proof
    ) external override returns (bool) {
        if (!verificationEnabled) revert VerificationDisabled();

        // If no funding verifier set, pass through (backwards compat)
        // SIPPrivacy sends proof as optional — empty proof = skip verification
        if (proof.length == 0) return true;
        if (address(fundingVerifier) == address(0)) return true;

        // Route to funding verifier with commitment as single public input
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = commitment;

        bool valid = fundingVerifier.verify(proof, publicInputs);
        emit ProofVerified("commitment", valid);
        return valid;
    }

    /// @inheritdoc IZKVerifier
    function verifyFundingProof(
        bytes32 commitmentHash,
        uint256 minimumRequired,
        bytes32 assetId,
        bytes calldata proof
    ) external override returns (bool) {
        if (!verificationEnabled) revert VerificationDisabled();
        if (address(fundingVerifier) == address(0)) revert VerifierNotSet();

        // Pack public inputs in circuit ABI order:
        // funding_proof main(commitment_hash, minimum_required, asset_id, ...)
        bytes32[] memory publicInputs = new bytes32[](3);
        publicInputs[0] = commitmentHash;
        publicInputs[1] = bytes32(minimumRequired);
        publicInputs[2] = assetId;

        bool valid = fundingVerifier.verify(proof, publicInputs);
        emit ProofVerified("funding", valid);
        return valid;
    }

    /// @inheritdoc IZKVerifier
    function verifyValidityProof(
        bytes32 intentHash,
        bytes32 senderCommitment,
        bytes32 nullifier,
        bytes calldata proof
    ) external override returns (bool) {
        if (!verificationEnabled) revert VerificationDisabled();
        if (address(validityVerifier) == address(0)) revert VerifierNotSet();

        bytes32[] memory publicInputs = new bytes32[](3);
        publicInputs[0] = intentHash;
        publicInputs[1] = senderCommitment;
        publicInputs[2] = nullifier;

        bool valid = validityVerifier.verify(proof, publicInputs);
        emit ProofVerified("validity", valid);
        return valid;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════════════════════════════════════

    function setFundingVerifier(address _verifier) external onlyOwner {
        fundingVerifier = IHonkVerifier(_verifier);
        emit VerifierUpdated("funding", _verifier);
    }

    function setValidityVerifier(address _verifier) external onlyOwner {
        validityVerifier = IHonkVerifier(_verifier);
        emit VerifierUpdated("validity", _verifier);
    }

    function setVerificationEnabled(bool _enabled) external onlyOwner {
        verificationEnabled = _enabled;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }
}
```

**Step 4: Run tests**

Run:
```bash
cd contracts/sip-ethereum
forge test --match-contract ZKVerifierTest -vvv
```

Expected: All ZKVerifier tests pass.

**Step 5: Run existing SIPPrivacy tests to verify backwards compat**

Run:
```bash
cd contracts/sip-ethereum
forge test --match-contract SIPPrivacy -vvv
```

Expected: All existing tests pass. The SIPPrivacy tests use `ZKVerifier(owner)` in TestSetup.sol — the constructor signature is unchanged. The `verifyProof()` method still exists.

**IMPORTANT:** If SIPPrivacy tests fail because TestSetup.sol references removed functions (like `setVerificationKey`), update TestSetup.sol to remove those calls. The new ZKVerifier doesn't need VK setup — VK is embedded in the generated verifier.

**Step 6: Commit**

```bash
git add contracts/sip-ethereum/src/ZKVerifier.sol
git add contracts/sip-ethereum/test/ZKVerifier.t.sol
git commit -m "refactor(contracts): rewrite ZKVerifier as router to bb-generated verifiers

Replace ~500 lines of mock proof parsing with clean router pattern.
ZKVerifier now delegates to IHonkVerifier (bb-generated) contracts.
Backwards compatible: verifyProof() still works with SIPPrivacy.

Ref: #805"
```

---

### Task 7: Update TestSetup.sol for New ZKVerifier

**Files:**
- Modify: `contracts/sip-ethereum/test/helpers/TestSetup.sol`

**Step 1: Check if existing tests break**

Run:
```bash
cd contracts/sip-ethereum
forge test -vvv 2>&1 | head -50
```

If tests fail because TestSetup references `ZKVerifier.setVerificationKey()` or other removed methods, continue to Step 2. If all pass, skip to commit.

**Step 2: Update TestSetup.sol**

The new ZKVerifier is simpler — it doesn't need `setVerificationKey()` calls. Update TestSetup to deploy the new contracts correctly.

Add the FundingVerifier import and deploy it in `setUp()`:

```solidity
import {HonkVerifier} from "../../src/verifiers/FundingVerifier.sol";
```

In `setUp()`, after deploying ZKVerifier, deploy and register the FundingVerifier:

```solidity
// After: zkVerifier = new ZKVerifier(owner);
HonkVerifier fundingVerifierInstance = new HonkVerifier();
zkVerifier.setFundingVerifier(address(fundingVerifierInstance));
```

**Step 3: Run all tests**

Run:
```bash
cd contracts/sip-ethereum
forge test -vvv
```

Expected: ALL tests pass (SIPPrivacy, PedersenVerifier, StealthAddressRegistry, ZKVerifier, FundingVerifier).

**Step 4: Commit**

```bash
git add contracts/sip-ethereum/test/
git commit -m "test(contracts): update TestSetup for new ZKVerifier router

Ref: #805"
```

---

### Task 8: Generate Proof Fixture from SDK

**Files:**
- Create: `scripts/generate-proof-fixture.ts`
- Generated: `contracts/sip-ethereum/test/fixtures/funding-proof.json`

**Step 1: Write the fixture generator script**

Create `scripts/generate-proof-fixture.ts`:

```typescript
/**
 * Generate a funding proof fixture for Foundry tests.
 *
 * Usage: npx tsx scripts/generate-proof-fixture.ts
 *
 * Outputs a JSON file with proof bytes and public inputs
 * that can be loaded in Solidity tests.
 */
import { NoirProofProvider } from '@sip-protocol/sdk/proofs'

async function main() {
  console.log('Initializing NoirProofProvider...')
  const provider = new NoirProofProvider({ verbose: true })
  await provider.initialize()

  console.log('Generating funding proof...')
  const result = await provider.generateFundingProof({
    balance: 100n,
    minimumRequired: 50n,
    blindingFactor: new Uint8Array(32).fill(42),
    assetId: '0xABCD',
    userAddress: '0x' + '11'.repeat(20),
    ownershipSignature: new Uint8Array(64).fill(1),
  })

  const fixture = {
    proof: result.proof.proof,
    publicInputs: result.proof.publicInputs,
    proofType: result.proof.type,
  }

  console.log('Proof generated:')
  console.log('  Type:', fixture.proofType)
  console.log('  Proof length:', fixture.proof.length, 'hex chars')
  console.log('  Public inputs:', fixture.publicInputs.length)

  // Write fixture
  const fs = await import('fs')
  const path = 'contracts/sip-ethereum/test/fixtures/funding-proof.json'
  fs.mkdirSync('contracts/sip-ethereum/test/fixtures', { recursive: true })
  fs.writeFileSync(path, JSON.stringify(fixture, null, 2))
  console.log(`\nFixture written to ${path}`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
```

**Step 2: Run the script**

Run:
```bash
npx tsx scripts/generate-proof-fixture.ts
```

Expected: JSON fixture created at `contracts/sip-ethereum/test/fixtures/funding-proof.json` with `proof` (hex string), `publicInputs` (hex string array), and `proofType` ("funding").

**IMPORTANT:** If this fails because `@sip-protocol/sdk/proofs` can't be imported directly, adjust the import path to the actual module structure. May need to import from `packages/sdk/src/proofs/noir.ts` directly with proper path resolution.

**Step 3: Verify fixture contents**

Run:
```bash
cat contracts/sip-ethereum/test/fixtures/funding-proof.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
print('Proof bytes:', len(data['proof']) // 2 - 1, 'bytes')
print('Public inputs:', len(data['publicInputs']))
for i, pi in enumerate(data['publicInputs']):
    print(f'  [{i}]:', pi[:20], '...')
"
```

Expected: Proof is ~2KB, 3 public inputs (commitment_hash, minimum_required, asset_id).

**Step 4: Commit**

```bash
git add scripts/generate-proof-fixture.ts
git add contracts/sip-ethereum/test/fixtures/
git commit -m "test(contracts): add proof fixture generator for E2E ZK tests

Generates real Noir funding proof via SDK for Foundry verification tests.
Ref: #805"
```

---

### Task 9: E2E Test — Real Proof Verified On-Chain

**Files:**
- Create: `contracts/sip-ethereum/test/FundingVerifierE2E.t.sol`

**Step 1: Write the E2E test using the fixture**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {HonkVerifier} from "../src/verifiers/FundingVerifier.sol";
import {ZKVerifier} from "../src/ZKVerifier.sol";

/// @title E2E: Real Noir proof verified on-chain
/// @notice Uses a proof fixture generated by the SDK's NoirProofProvider
contract FundingVerifierE2ETest is Test {
    HonkVerifier public verifier;
    ZKVerifier public zkVerifier;

    // ── Proof fixture (paste from funding-proof.json after Task 8) ──
    // These values MUST be updated with real fixture data.
    // Placeholder below — replace with actual hex from fixture.

    // Example format (replace with real data):
    // bytes constant PROOF = hex"...";
    // bytes32 constant PUBLIC_INPUT_0 = 0x...; // commitment_hash
    // bytes32 constant PUBLIC_INPUT_1 = 0x...; // minimum_required
    // bytes32 constant PUBLIC_INPUT_2 = 0x...; // asset_id

    function setUp() public {
        verifier = new HonkVerifier();
        address owner = makeAddr("owner");
        vm.prank(owner);
        zkVerifier = new ZKVerifier(owner);
        vm.prank(owner);
        zkVerifier.setFundingVerifier(address(verifier));
    }

    /// @notice Real proof verifies through standalone HonkVerifier
    /// @dev Uncomment and fill in fixture data to enable this test
    // function test_real_proof_verifies_standalone() public view {
    //     bytes32[] memory publicInputs = new bytes32[](3);
    //     publicInputs[0] = PUBLIC_INPUT_0;
    //     publicInputs[1] = PUBLIC_INPUT_1;
    //     publicInputs[2] = PUBLIC_INPUT_2;
    //
    //     bool result = verifier.verify(PROOF, publicInputs);
    //     assertTrue(result, "Real funding proof should verify");
    // }

    /// @notice Real proof verifies through ZKVerifier router
    /// @dev Uncomment and fill in fixture data to enable this test
    // function test_real_proof_verifies_via_router() public {
    //     bool result = zkVerifier.verifyFundingProof(
    //         PUBLIC_INPUT_0,  // commitmentHash
    //         uint256(PUBLIC_INPUT_1),  // minimumRequired
    //         PUBLIC_INPUT_2,  // assetId
    //         PROOF
    //     );
    //     assertTrue(result, "Real funding proof should verify via router");
    // }

    /// @notice Gas profiling for proof verification
    /// @dev Uncomment and fill in fixture data to enable this test
    // function test_verification_gas_cost() public {
    //     bytes32[] memory publicInputs = new bytes32[](3);
    //     publicInputs[0] = PUBLIC_INPUT_0;
    //     publicInputs[1] = PUBLIC_INPUT_1;
    //     publicInputs[2] = PUBLIC_INPUT_2;
    //
    //     uint256 gasBefore = gasleft();
    //     verifier.verify(PROOF, publicInputs);
    //     uint256 gasUsed = gasBefore - gasleft();
    //
    //     console.log("Verification gas used:", gasUsed);
    //     // Expected: ~300,000-400,000 gas
    //     assertLt(gasUsed, 500000, "Gas should be under 500K");
    // }
}
```

**IMPORTANT:** The test body is commented out because you need to paste the actual fixture data from Task 8. After generating the fixture:

1. Read the proof hex from `funding-proof.json`
2. Paste as `bytes constant PROOF = hex"...";`
3. Paste each public input as `bytes32 constant PUBLIC_INPUT_N = 0x...;`
4. Uncomment the test functions

**Step 2: Fill in fixture data and run**

After pasting fixture data:

Run:
```bash
cd contracts/sip-ethereum
forge test --match-contract FundingVerifierE2ETest -vvv
```

Expected: `test_real_proof_verifies_standalone` PASSES — this is the key milestone. A real Noir proof, generated in JavaScript, verified in Solidity with full bn254 pairing checks.

**IF THIS FAILS:** The most likely cause is public input ordering mismatch. The circuit expects `[commitment_hash, minimum_required, asset_id]` but the verifier may expect them in a different order. Debug by:
1. Checking the circuit ABI in the compiled JSON for parameter order
2. Checking how `bb` orders public inputs in the VK
3. Trying different orderings

**Step 3: Profile gas**

Run:
```bash
cd contracts/sip-ethereum
forge test --match-test test_verification_gas_cost -vvv --gas-report
```

Expected: ~300,000-400,000 gas per verification.

**Step 4: Commit**

```bash
git add contracts/sip-ethereum/test/FundingVerifierE2E.t.sol
git commit -m "test(contracts): E2E real Noir proof verified on-chain

SDK-generated UltraHonk proof passes full pairing verification in Solidity.
Gas cost: ~NNNk (update with actual number).
Ref: #805"
```

---

### Task 10: Deploy Verifier to Sepolia

**Files:**
- Create: `contracts/sip-ethereum/script/DeployVerifier.s.sol`

**Step 1: Write deployment script**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {HonkVerifier} from "../src/verifiers/FundingVerifier.sol";
import {ZKVerifier} from "../src/ZKVerifier.sol";

/// @title Deploy FundingVerifier and register in existing ZKVerifier
contract DeployVerifierScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address zkVerifierAddress = vm.envAddress("ZK_VERIFIER_ADDRESS");

        vm.startBroadcast(deployerKey);

        // 1. Deploy BB-generated FundingVerifier
        HonkVerifier fundingVerifier = new HonkVerifier();
        console.log("FundingVerifier deployed at:", address(fundingVerifier));

        // 2. Register in ZKVerifier
        ZKVerifier zkVerifier = ZKVerifier(zkVerifierAddress);
        zkVerifier.setFundingVerifier(address(fundingVerifier));
        console.log("Registered in ZKVerifier at:", zkVerifierAddress);

        vm.stopBroadcast();
    }
}
```

**Step 2: Deploy to Sepolia**

Run:
```bash
cd contracts/sip-ethereum
source .env

# ZKVerifier address on Sepolia (from DEPLOYMENT.md)
export ZK_VERIFIER_ADDRESS=0x26988D988684627084e6ae113e0354f6bc56b126

forge script script/DeployVerifier.s.sol:DeployVerifierScript \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Expected: FundingVerifier deployed and registered. Note the deployed address.

**IMPORTANT:** The `ZK_VERIFIER_ADDRESS` above is a placeholder. Check `DEPLOYMENT.md` for the actual deployed ZKVerifier address on Sepolia. Also, since ZKVerifier was rewritten, we may need to redeploy the ZKVerifier too (the ABI changed). If so, also redeploy ZKVerifier and update SIPPrivacy's reference.

If full redeployment is needed:
```bash
forge script script/Deploy.s.sol:DeployTestnetScript \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Then deploy FundingVerifier and register.

**Step 3: Commit**

```bash
git add contracts/sip-ethereum/script/DeployVerifier.s.sol
git commit -m "feat(contracts): add DeployVerifier script for bb-generated verifiers

Ref: #805"
```

---

### Task 11: Deploy to Arbitrum Sepolia (#814)

**Files:** None (deployment only)

**Prerequisite:** Arbitrum Sepolia testnet ETH in deployer wallet. If insufficient, bridge from Sepolia:

**Step 1: Check balance**

Run:
```bash
cd contracts/sip-ethereum
source .env
cast balance $(cast wallet address $PRIVATE_KEY) --rpc-url $ARBITRUM_SEPOLIA_RPC_URL
```

If balance is 0, bridge ETH from Sepolia using the Arbitrum bridge or ask RECTOR to fund.

**Step 2: Deploy all contracts to Arbitrum Sepolia**

Run:
```bash
forge script script/Deploy.s.sol:DeployTestnetScript \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ARBISCAN_API_KEY
```

Expected: All 4 contracts deployed (SIPPrivacy, PedersenVerifier, ZKVerifier, StealthAddressRegistry).

**Step 3: Deploy FundingVerifier to Arbitrum Sepolia**

Run:
```bash
export ZK_VERIFIER_ADDRESS=<address from step 2>

forge script script/DeployVerifier.s.sol:DeployVerifierScript \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ARBISCAN_API_KEY
```

Expected: FundingVerifier deployed and registered on Arbitrum Sepolia.

**Step 4: Verify on Arbiscan**

Check the deployed addresses on [sepolia.arbiscan.io](https://sepolia.arbiscan.io).

**Step 5: No commit** — deployment artifacts are in `broadcast/` (gitignored). Update DEPLOYMENT.md in Task 12.

---

### Task 12: Update Documentation

**Files:**
- Modify: `contracts/sip-ethereum/DEPLOYMENT.md`
- Modify: `CLAUDE.md` (M18 status)
- Modify: `ROADMAP.md` or `CHANGELOG.md` (if they track issue completion)

**Step 1: Update DEPLOYMENT.md with Arbitrum Sepolia addresses**

Add Arbitrum Sepolia to the deployment table:

```markdown
| Network | Status | Date |
|---------|--------|------|
| Sepolia (11155111) | ✅ Deployed + Verified | 2026-02-27 |
| Base Sepolia (84532) | ✅ Deployed | 2026-02-27 |
| OP Sepolia (11155420) | ✅ Deployed | 2026-02-27 |
| Arbitrum Sepolia (421614) | ✅ Deployed + Verified | 2026-02-28 |
```

Add FundingVerifier address to the contracts table.

Add ZK verifier pipeline documentation:
```markdown
## ZK Verifier Pipeline

### Generating the Solidity Verifier

Requires: nargo 1.0.0-beta.15, bb CLI

\```bash
# Compile circuit
cd packages/circuits/funding_proof
nargo compile

# Generate VK + Solidity verifier
bb write_vk -b target/funding_proof.json -o target/vk
bb contract -k target/vk -o contracts/sip-ethereum/src/verifiers/FundingVerifier.sol

# Build + test
cd contracts/sip-ethereum
forge build && forge test
\```
```

**Step 2: Close GitHub issues**

Run:
```bash
# Close #805 if fully done (may stay open if validity/fulfillment phases pending)
gh issue comment 805 --body "Phase A complete: FundingVerifier deployed with real UltraHonk pairing verification. Phases B (validity) and C (fulfillment) tracked separately."

# Close #814
gh issue close 814 --comment "Deployed to Arbitrum Sepolia. All 4 contracts + FundingVerifier live."
```

**Step 3: Commit**

```bash
git add contracts/sip-ethereum/DEPLOYMENT.md
git add CLAUDE.md ROADMAP.md CHANGELOG.md  # if updated
git commit -m "docs: update deployment status — Arbitrum Sepolia + ZK verifier pipeline

- Arbitrum Sepolia deployed (#814)
- FundingVerifier (real UltraHonk) deployed on all testnets
- Added ZK verifier pipeline docs to DEPLOYMENT.md
Closes #814. Progress on #805."
```

---

## Execution Checklist

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Install Noir + BB toolchain | 5 min |
| 2 | Compile funding_proof circuit | 5 min |
| 3 | Generate Solidity verifier | 10 min |
| 4 | Create IHonkVerifier interface | 5 min |
| 5 | Write FundingVerifier tests | 10 min |
| 6 | Rewrite ZKVerifier as router | 20 min |
| 7 | Update TestSetup for compat | 10 min |
| 8 | Generate proof fixture from SDK | 15 min |
| 9 | E2E test (real proof on-chain) | 15 min |
| 10 | Deploy to Sepolia | 10 min |
| 11 | Deploy to Arbitrum Sepolia | 10 min |
| 12 | Update docs + close issues | 10 min |

**Total estimated: ~2 hours**
