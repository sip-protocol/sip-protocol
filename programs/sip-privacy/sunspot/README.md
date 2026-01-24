# Sunspot ZK Verifier Pipeline

Noir → ACIR → Groth16 → Solana verification pipeline using Sunspot.

## Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Noir Circuit│ --> │ ACIR (.json)│ --> │ Groth16 Proof│ --> │Solana Verify│
│  (main.nr)  │     │   sunspot   │     │   (.proof)   │     │   (.so)     │
└─────────────┘     │   compile   │     │   sunspot    │     │   on-chain  │
                    └─────────────┘     │    prove     │     └─────────────┘
                                        └─────────────┘
```

## Prerequisites

### 1. Install Sunspot

```bash
# Requires Go 1.24+
git clone https://github.com/reilabs/sunspot.git ~/sunspot
cd ~/sunspot/go && go build -o sunspot .
export PATH="$HOME/sunspot/go:$PATH"
export GNARK_VERIFIER_BIN="$HOME/sunspot/gnark-solana/crates/verifier-bin"
```

### 2. Install Nargo

```bash
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup -v 1.0.0-beta.13
```

### 3. Verify Installation

```bash
sunspot --version
nargo --version
```

## Circuits

| Circuit | Purpose | Source |
|---------|---------|--------|
| `funding_proof` | Prove balance >= minimum | `circuits/funding_proof/` |
| `ownership_proof` | Prove stealth key ownership | `circuits/ownership_proof/` |

## Pipeline Commands

### Step 1: Compile Noir to CCS

```bash
# From circuit directory
cd circuits/funding_proof
nargo compile

# Convert ACIR to CCS (Sunspot format)
sunspot compile --input target/funding_proof.json --output funding_proof.ccs
```

### Step 2: Generate Proving/Verification Keys

```bash
sunspot setup --ccs funding_proof.ccs \
  --pk funding_proof.pk \
  --vk funding_proof.vk
```

### Step 3: Generate Proof

```bash
# Create Prover.toml with inputs
sunspot prove \
  --ccs funding_proof.ccs \
  --pk funding_proof.pk \
  --witness Prover.toml \
  --proof funding_proof.proof
```

### Step 4: Build Solana Verifier

```bash
sunspot deploy \
  --vk funding_proof.vk \
  --output verifier.so
```

### Step 5: Deploy Verifier

```bash
solana program deploy verifier.so --program-id verifier-keypair.json
```

## Integration with SIP Privacy

The SIP Privacy program calls the verifier via CPI:

```rust
// In shielded_transfer instruction
let verify_ix = Instruction {
    program_id: VERIFIER_PROGRAM_ID,
    accounts: vec![],
    data: [proof_bytes, public_inputs].concat(),
};

invoke(&verify_ix, &[])?;
```

## Compute Units

| Operation | CU |
|-----------|-----|
| Groth16 verification | ~200,000 |
| altbn128 pairing | ~150,000 |
| G1/G2 point ops | ~20,000 |

## Files

```
sunspot/
├── README.md           # This file
├── scripts/
│   ├── compile.sh      # Compile all circuits
│   ├── setup.sh        # Generate keys
│   ├── prove.sh        # Generate proofs
│   └── deploy.sh       # Deploy verifier
├── keys/               # Proving/verification keys (git-ignored)
├── proofs/             # Generated proofs (git-ignored)
└── verifier/           # Compiled verifier program
```

## References

- [Sunspot](https://github.com/reilabs/sunspot)
- [Solana Foundation Noir Examples](https://github.com/solana-foundation/noir-examples)
- [groth16-solana](https://github.com/Lightprotocol/groth16-solana)
- [Noir Documentation](https://noir-lang.org/docs)
