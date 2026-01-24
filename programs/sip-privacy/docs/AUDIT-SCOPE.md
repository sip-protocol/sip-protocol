# SIP Privacy Audit Scope

## Program Information

| Field | Value |
|-------|-------|
| Program ID | `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` |
| Network | Devnet (auditing), Mainnet-beta (target) |
| Language | Rust (Anchor 0.30.1) |
| Solana Version | 1.18.26 |
| LOC | ~500 |

## In Scope

### Smart Contract Code

```
programs/sip-privacy/
├── programs/sip-privacy/
│   └── src/
│       └── lib.rs          # Main program (all instructions)
├── Cargo.toml              # Dependencies
├── Anchor.toml             # Anchor configuration
└── tests/
    └── sip-privacy.ts      # TypeScript tests
```

### Instructions

| Instruction | Description | Priority |
|-------------|-------------|----------|
| `initialize` | Create config PDA, set authority/fees | High |
| `shielded_transfer` | Execute privacy-preserving transfer | Critical |
| `pause` / `unpause` | Emergency circuit breaker | Medium |
| `update_fee` | Modify fee basis points | Medium |

### Accounts

| Account | Type | Description |
|---------|------|-------------|
| `Config` | PDA | Global settings (authority, fees, pause) |
| `TransferRecord` | PDA | Per-transfer metadata storage |

### Cryptographic Components

| Component | Implementation | Priority |
|-----------|----------------|----------|
| Pedersen Commitments | 33-byte compressed points | Critical |
| Stealth Addresses | ed25519 pubkeys | Critical |
| Viewing Key Hash | SHA-256 | High |
| Encrypted Amount | XOR (placeholder) | Medium |
| ZK Proofs | Mock (placeholder) | Critical |

## Out of Scope

### Off-Chain Code

- `packages/sdk/` - TypeScript SDK
- `packages/react/` - React hooks
- Frontend applications
- CLI tools

### Third-Party Dependencies

- Solana runtime
- Anchor framework
- SPL libraries

### Future Features

- SPL token support (not implemented)
- Batch transfers (not implemented)
- Authority transfer (not implemented)

## Focus Areas

### 1. Access Control (Critical)

- Authority validation in `initialize`, `pause`, `unpause`, `update_fee`
- PDA derivation correctness
- Account ownership checks

### 2. Cryptographic Correctness (Critical)

- Commitment validation (33 bytes, valid point)
- Ephemeral pubkey format
- Viewing key hash computation
- No information leakage

### 3. State Management (High)

- Config initialization (no reinitialization)
- Transfer record creation
- Counter increment atomicity

### 4. Arithmetic Safety (High)

- Fee calculation (no overflow)
- Amount validation (non-zero, positive)
- Lamport transfers (sufficient balance)

### 5. Error Handling (Medium)

- Appropriate error codes
- No panics in production paths
- Graceful failure modes

## Known Issues

### Accepted Risks

1. **Mock ZK Proofs**: Current implementation accepts any 128-byte proof. Real verification required before mainnet.

2. **XOR Encryption**: Placeholder encryption for amounts. XChaCha20-Poly1305 required for production.

3. **Transitive Vulnerability**: curve25519-dalek timing issue from Solana SDK (RUSTSEC-2024-0344).

### Deferred to V2

1. SPL token support
2. Batch transfers
3. Authority multisig
4. Emergency withdrawal

## Audit Deliverables Expected

1. **Vulnerability Report**: All findings with severity, impact, recommendations
2. **Code Quality Review**: Best practices, gas optimization, maintainability
3. **Remediation Verification**: Re-audit of fixes

## Contact

- **Repository**: https://github.com/sip-protocol/sip-protocol
- **Program Path**: `programs/sip-privacy/`
- **Primary Contact**: rector@rectorspace.com
