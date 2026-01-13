# SIP Protocol Security Architecture

| Field | Value |
|-------|-------|
| **Document** | SEC-ARCH-001 |
| **Version** | 1.0.0 |
| **Date** | 2026-01-13 |
| **Status** | Production |

## Executive Summary

This document provides a comprehensive overview of SIP Protocol's security architecture, designed for security auditors and compliance teams. SIP implements a privacy layer for cross-chain transactions using well-established cryptographic primitives.

## 1. Security Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
│  Wallets • DEXs • Payment Apps • Enterprise Compliance Dashboards           │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SIP PROTOCOL SDK                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      PRIVACY LAYER                                    │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │  Stealth    │ │  Pedersen   │ │  Viewing    │ │    ZK       │    │   │
│  │  │  Addresses  │ │ Commitments │ │    Keys     │ │   Proofs    │    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      VALIDATION LAYER                                 │   │
│  │  Input Validation • Type Checking • Range Proofs • Error Handling    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      CRYPTO LAYER                                     │   │
│  │  @noble/curves (secp256k1, ed25519) • @noble/hashes • @noble/ciphers │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SETTLEMENT LAYER                                     │
│  NEAR Intents • Direct Chain Settlement • Zcash Shielded Pool               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Cryptographic Primitives Inventory

### 2.1 Core Primitives

| Primitive | Library | Version | Usage | Audit Status |
|-----------|---------|---------|-------|--------------|
| **secp256k1** | @noble/curves | 1.8.x | EVM stealth addresses | Cure53 Audited |
| **ed25519** | @noble/curves | 1.8.x | Solana/NEAR stealth addresses | Cure53 Audited |
| **SHA-256** | @noble/hashes | 1.7.x | Key derivation, commitments | Cure53 Audited |
| **SHA-512** | @noble/hashes | 1.7.x | HMAC for key derivation | Cure53 Audited |
| **HKDF** | @noble/hashes | 1.7.x | Key derivation | Cure53 Audited |
| **XChaCha20-Poly1305** | @noble/ciphers | 1.2.x | Viewing key encryption | Cure53 Audited |
| **Pedersen Commitments** | Custom (over secp256k1) | - | Amount hiding | **Pending Audit** |
| **Noir Circuits** | @aztec/bb.js | 0.x | ZK proofs | Aztec Audited |

### 2.2 Security Dependencies

All cryptographic operations use the `@noble/*` family of libraries by Paul Miller:
- **Audit**: [Cure53 Audit Report](https://github.com/paulmillr/noble-curves/blob/main/audit/2022-12-cure53-audit-nbl2.pdf)
- **Properties**: Constant-time, no external dependencies, TypeScript-native

## 3. Trust Boundaries

### 3.1 Trust Zones

```
┌─────────────────────────────────────────────────────────────────────┐
│ UNTRUSTED ZONE                                                       │
│ • Network traffic                                                    │
│ • Solver responses                                                   │
│ • External RPC responses                                             │
│ • User-provided data                                                 │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ VALIDATION BOUNDARY
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ VALIDATED ZONE                                                       │
│ • Validated inputs (addresses, amounts, chains)                      │
│ • Parsed and type-checked data                                       │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ CRYPTOGRAPHIC BOUNDARY
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ TRUSTED ZONE                                                         │
│ • Private keys (never leave this zone)                               │
│ • Viewing keys (selective disclosure)                                │
│ • Proofs (cryptographically verified)                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Management

| Key Type | Storage | Exposure | Recovery |
|----------|---------|----------|----------|
| Spending Key | Client-side only | Never transmitted | User responsibility |
| Viewing Key | Client-side + auditor | Selective disclosure | Derivable from spending |
| Ephemeral Keys | Memory only | Transaction lifetime | Non-recoverable |
| Stealth Keys | Derived per transaction | Destination address | Derivable from spending + ephemeral |

## 4. Data Flow Security

### 4.1 Shielded Intent Creation

```
User Input                          Shielded Output
────────────                        ───────────────
sender: 0x1234...    ──────────▶    inputCommitment: 0xabc... (Pedersen)
amount: 1.5 ETH      ──────────▶    proof: 0xdef... (ZK)
recipient: 0x5678... ──────────▶    stealthAddress: 0x999... (one-time)
```

### 4.2 Privacy Guarantees by Level

| Level | Sender | Amount | Recipient | Auditable |
|-------|--------|--------|-----------|-----------|
| `TRANSPARENT` | Visible | Visible | Visible | N/A |
| `SHIELDED` | Hidden (commitment) | Hidden (commitment) | Hidden (stealth) | No |
| `COMPLIANT` | Hidden (commitment) | Hidden (commitment) | Hidden (stealth) | Yes (viewing key) |

## 5. Input Validation

All public API inputs are validated at the system boundary:

### 5.1 Address Validation

```typescript
// EVM: Checksum + format validation
validateEVMAddress('0x1234...') // Throws ValidationError if invalid

// Solana: Base58 + length validation
validateSolanaAddress('7xK9...') // Throws ValidationError if invalid

// Cross-chain: Chain-specific validation
validateAddress('0x1234...', 'ethereum')
validateAddress('7xK9...', 'solana')
```

### 5.2 Amount Validation

```typescript
// Range checks
validateAmount(amount)  // Must be > 0, <= MAX_UINT256

// Decimal precision
validateDecimals(amount, decimals)  // Must fit token decimals
```

### 5.3 Error Codes

| Code | Description |
|------|-------------|
| `INVALID_ADDRESS` | Malformed or invalid address format |
| `INVALID_AMOUNT` | Amount out of valid range |
| `INVALID_CHAIN` | Unsupported blockchain |
| `CRYPTO_ERROR` | Cryptographic operation failed |
| `VALIDATION_ERROR` | Generic validation failure |

## 6. Known Limitations

### 6.1 Timing Attacks

While @noble/curves provides constant-time operations, the overall SDK does not guarantee constant-time execution for all operations. High-security deployments should consider additional mitigations.

### 6.2 Memory Security

The SDK provides `SecureMemory` utilities for key zeroization, but JavaScript's garbage collector may leave residual data in memory. For high-security environments, consider native implementations.

### 6.3 Network Privacy

The SDK provides transaction-level privacy but does not protect network-level metadata (IP addresses, timing). Users requiring network privacy should use additional tools (Tor, VPN).

## 7. Compliance Features

### 7.1 Viewing Keys

Viewing keys enable selective disclosure for regulatory compliance:

```typescript
// Generate viewing key during intent creation
const viewingKey = generateViewingKey()

// Encrypt transaction details
const encrypted = encryptForViewing(txDetails, viewingKey.publicKey)

// Auditor decrypts with viewing private key
const decrypted = decryptWithViewing(encrypted, viewingKey.privateKey)
```

### 7.2 Audit Trail

| Data | Visibility | Access |
|------|------------|--------|
| Intent ID | Public | Anyone |
| Transaction hash | Public | Anyone |
| Amount | Encrypted | Viewing key holder |
| Sender | Encrypted | Viewing key holder |
| Recipient | Encrypted | Viewing key holder |

## 8. Security Contacts

- **Email**: security@sip-protocol.org
- **GitHub Security**: https://github.com/sip-protocol/sip-protocol/security
- **Responsible Disclosure**: 90-day policy

## 9. Related Documents

- [THREAT-MODEL.md](./THREAT-MODEL.md) - Detailed threat analysis
- [AUDIT-SCOPE.md](./AUDIT-SCOPE.md) - Audit scope and priorities
- [CRYPTO-CHOICES.md](./CRYPTO-CHOICES.md) - Cryptographic primitive justification
- [DEPENDENCY-AUDIT.md](./DEPENDENCY-AUDIT.md) - Dependency vulnerability analysis

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-13 | 1.0.0 | Initial security architecture document |
