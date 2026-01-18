# Vanity Address Specification

> **Purpose:** Define vanity address strategy for SIP Protocol branding across chains
> **Status:** Draft
> **Created:** 2026-01-18

---

## Overview

Vanity addresses improve brand recognition by using memorable prefixes for on-chain identities. This spec defines which components should use vanity addresses and the target prefixes for each chain type.

---

## Chain Encoding Compatibility

### Base58 (Solana, Bitcoin, NEAR implicit)

**Character set:** `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`

**Excluded characters:** `0, O, I, l` (zero, uppercase O, uppercase I, lowercase L) — to avoid visual confusion

| Character | In Base58? | Substitute | Notes |
|-----------|------------|------------|-------|
| S | ✅ Yes | - | Uppercase |
| I | ❌ No | `1` or `i` | Excluded to avoid confusion with `1` and `l` |
| P | ✅ Yes | - | Uppercase |

**"SIP" is NOT possible in base58** ❌

**Alternatives:**
- `S1P` — Uses `1` as `I` (recommended, most readable)
- `Sip` — Uses lowercase `i` (valid but mixed case)
- `51P` — Full leetspeak

### Hexadecimal (Ethereum, EVM L2s)

**Character set:** `0-9, a-f` (case-insensitive)

| Character | In Hex? | Substitute | Visual |
|-----------|---------|------------|--------|
| S | ❌ No | 5 | 5 ≈ S |
| I | ❌ No | 1 | 1 ≈ I |
| P | ❌ No | None | No good substitute |

**"SIP" is NOT possible in hex** ❌

---

## Hex Alternative: "5AFE" (SAFE)

Since "SIP" cannot be represented in hex, we use **"5AFE"** which reads as **"SAFE"**.

**Rationale:**
- Privacy = Safety (brand alignment)
- "SAFE by SIP" marketing angle
- Memorable and professional
- All characters valid in hex (5, A, F, E)

**Examples:**
- `0x5AFE...` (4 chars) — Primary target
- `0x5AFE51D...` (7 chars) — "SAFESID" (SAFE + SID) — Stretch goal

---

## Vanity Targets

### Priority 1: Critical (Before M17 Deployment)

| Component | Chain | Target Prefix | Difficulty | Tool |
|-----------|-------|---------------|------------|------|
| **Anchor Program ID** | Solana | `S1P` | 3 chars | `solana-keygen grind` |
| **Treasury Wallet** | Solana | `S1P` | 3 chars | `solana-keygen grind` |

### Priority 2: High (Before M18 Deployment)

| Component | Chain | Target Prefix | Difficulty | Tool |
|-----------|-------|---------------|------------|------|
| **Solidity Contract** | Ethereum | `0x5AFE` | 4 chars | CREATE2 salt grinding |
| **L2 Contracts** | Base/Arb/OP | `0x5AFE` | 4 chars | CREATE2 (same salt works cross-L2) |

### Priority 3: Medium (Future)

| Component | Chain | Target Prefix | Difficulty | Tool |
|-----------|-------|---------------|------------|------|
| **Token Mint** | Solana | `SIP` | 3 chars | `solana-keygen grind` |
| **Governance Token** | Ethereum | `0x5AFE` | 4 chars | CREATE2 |
| **Multisig** | Solana | `SIP` | 3 chars | `solana-keygen grind` |

### Not Applicable

| Component | Reason |
|-----------|--------|
| Stealth Addresses | Generated per-transaction, not static |
| Viewing Keys | Generated per-user, not static |
| Ephemeral Keys | Random by design |

---

## Named Accounts (No Grinding Required)

| Platform | Target Name | Status |
|----------|-------------|--------|
| NEAR | `sip.near` or `sip-protocol.near` | 🔲 To register |
| ENS | `sip.eth` or `sipprotocol.eth` | 🔲 To register |
| SNS (Solana) | `sip.sol` | 🔲 To register |
| Unstoppable | `sip.crypto` | 🔲 To check availability |

---

## Difficulty Estimates

### Solana (Base58, 58 possible chars per position)

| Prefix Length | Combinations | Est. Time (CPU) | Est. Time (GPU) |
|---------------|--------------|-----------------|-----------------|
| 3 chars (SIP) | ~195K | Minutes | Seconds |
| 4 chars (SIPx) | ~11M | Hours | Minutes |
| 5 chars (SIPxx) | ~656M | Days | Hours |
| 6 chars | ~38B | Weeks | Days |

### Ethereum (Hex, 16 possible chars per position)

| Prefix Length | Combinations | Est. Time (CPU) | Est. Time (GPU) |
|---------------|--------------|-----------------|-----------------|
| 4 chars (5AFE) | ~65K | Minutes | Seconds |
| 5 chars | ~1M | Hours | Minutes |
| 6 chars | ~16M | Hours | Minutes |
| 7 chars (5AFE51D) | ~268M | Days | Hours |

---

## Generation Tools

### Solana

```bash
# Built-in CLI tool
solana-keygen grind --starts-with SIP:1

# Multiple patterns (runs in parallel)
solana-keygen grind --starts-with SIP:1 --starts-with SIPpr:1

# Output: saves to .json keypair file
```

### Ethereum (CREATE2)

For deterministic contract deployment:

```solidity
// Contract address = keccak256(0xff, deployer, salt, initCodeHash)[12:]
// Grind the salt until address starts with 0x5AFE
```

Tools:
- [create2crunch](https://github.com/0age/create2crunch) — GPU-accelerated
- [create2-vrf](https://github.com/Vectorized/create2-vrf) — Rust implementation
- Custom script with ethers.js

### GPU Acceleration

For longer prefixes, use GPU:
- **Solana:** [solana-vanity](https://github.com/piotrostr/solana-vanity) (CUDA)
- **Ethereum:** [profanity2](https://github.com/1inch/profanity2) (OpenCL) — Note: Original profanity had vulnerability, use v2

---

## Security Considerations

1. **Private Key Storage:** Generated keypairs contain private keys. Store securely.
2. **Profanity Vulnerability:** Original profanity tool had a vulnerability. Only use patched versions.
3. **Offline Generation:** Generate vanity keys on air-gapped machine for critical addresses.
4. **Backup:** Store keypair JSON files in encrypted backup (not git).

---

## Implementation Checklist

### Phase 1: Solana (M17)

- [ ] Generate `SIP...` keypair for Anchor Program ID
- [ ] Generate `SIP...` keypair for Treasury Wallet
- [ ] Store keypairs securely (not in repo)
- [ ] Document program ID in CLAUDE.md after deployment
- [ ] Register `sip.sol` SNS domain

### Phase 2: Ethereum (M18)

- [ ] Calculate CREATE2 salt for `0x5AFE...` deployment
- [ ] Verify same salt works across L2s (Base, Arbitrum, Optimism)
- [ ] Document contract addresses in CLAUDE.md
- [ ] Register `sip.eth` ENS domain

### Phase 3: Cross-Chain

- [ ] Register `sip.near` NEAR account
- [ ] Generate token mint vanity address (if applicable)
- [ ] Update all documentation with final addresses

---

## Address Registry

| Component | Chain | Address | Generated |
|-----------|-------|---------|-----------|
| Anchor Program | Solana | `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` | ✅ 2026-01-18 |
| Treasury | Solana | `S1P9WhBSbAGGatvrVE4TRBZfWpbG96U26zksy2TQj8q` | ✅ 2026-01-18 |
| Authority (Deploy/Upgrade) | Solana | `S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd` | ✅ 2026-01-18 |
| Solidity Contract | Ethereum | `0x5AFE...` | 🔲 Pending |
| Base Contract | Base L2 | `0x5AFE...` | 🔲 Pending |
| Arbitrum Contract | Arbitrum | `0x5AFE...` | 🔲 Pending |
| Optimism Contract | Optimism | `0x5AFE...` | 🔲 Pending |

---

## References

- [Solana Keygen Documentation](https://docs.solana.com/cli/usage#solana-keygen)
- [CREATE2 EIP-1014](https://eips.ethereum.org/EIPS/eip-1014)
- [Base58 Encoding](https://en.bitcoin.it/wiki/Base58Check_encoding)
- [Profanity2 (Safe Fork)](https://github.com/1inch/profanity2)

---

*Last Updated: 2026-01-18*
