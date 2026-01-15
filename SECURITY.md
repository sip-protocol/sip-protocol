# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.6.x   | :white_check_mark: |
| < 0.6   | :x:                |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@sip-protocol.org**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### What to Expect

1. **Acknowledgment**: Within 48 hours
2. **Initial Assessment**: Within 1 week
3. **Resolution Timeline**: Depends on severity
   - Critical: 24-48 hours
   - High: 1 week
   - Medium: 2 weeks
   - Low: Next release

### Disclosure Policy

- We follow a 90-day disclosure timeline
- We will coordinate disclosure with you
- Credit will be given unless you prefer anonymity

### Safe Harbor

We consider security research conducted in good faith to be authorized. We will not pursue legal action against researchers who:
- Make a good faith effort to avoid privacy violations and data destruction
- Only interact with accounts they own or have permission to test
- Do not exploit vulnerabilities beyond what is necessary to demonstrate them

## Threat Model

### What SIP Protects

| Threat | Protection Level | Mechanism |
|--------|------------------|-----------|
| **Sender Privacy** | Strong | Stealth addresses (one-time addresses) |
| **Amount Privacy** | Strong | Pedersen commitments (homomorphic hiding) |
| **Recipient Privacy** | Strong | Stealth address derivation |
| **Transaction Linkability** | Strong | Fresh ephemeral keys per transaction |
| **Compliance/Audit** | Selective | Viewing keys for authorized disclosure |

### What SIP Does NOT Protect Against

| Threat | Status | Notes |
|--------|--------|-------|
| **Timing Analysis** | Not protected | Transaction timing may leak metadata |
| **Network-Level Surveillance** | Not protected | IP addresses visible to RPC providers |
| **Compromised Spending Key** | Not protected | Full fund access if compromised |
| **Compromised Viewing Key** | Partial exposure | Can see amounts but not spend |
| **Side-Channel Attacks** | Limited | Depends on execution environment |
| **51% / Consensus Attacks** | Inherited | Depends on underlying blockchain |

### Trust Assumptions

1. **Cryptographic Hardness**: secp256k1 ECDLP and ed25519 DLP are computationally hard
2. **Hash Functions**: SHA-256 and Blake2b are collision-resistant
3. **RNG Quality**: System random number generator is secure
4. **Execution Environment**: Code runs in non-compromised environment
5. **Settlement Backends**: Underlying settlement layer operates correctly

## Cryptographic Primitives

### Libraries

All cryptography uses audited, well-maintained libraries:

| Library | Purpose | Audit Status |
|---------|---------|--------------|
| `@noble/curves` | Elliptic curve operations | Audited by Cure53 |
| `@noble/hashes` | Hash functions (SHA-256, Blake2b) | Audited by Cure53 |
| `@noble/ciphers` | Symmetric encryption (XChaCha20-Poly1305) | Audited by Cure53 |

### Elliptic Curves

| Curve | Usage | Security Level |
|-------|-------|----------------|
| **secp256k1** | EVM chains (Ethereum, BSC, Polygon) | ~128-bit |
| **ed25519** | Solana, NEAR, Cosmos chains | ~128-bit |

### Commitment Scheme

**Pedersen Commitments** for amount hiding:

```
C = value × G + blinding × H
```

- **G**: Generator point of the curve
- **H**: Hash-to-curve derived second generator (nothing-up-my-sleeve)
- **Binding**: Computationally infeasible to find different (value, blinding) for same C
- **Hiding**: C reveals nothing about value (perfect information-theoretic hiding)

### Stealth Addresses (EIP-5564 Style)

```
1. Sender generates ephemeral keypair (r, R = r·G)
2. Shared secret: S = r · V (V = viewing public key)
3. Stealth public key: P' = P + H(S)·G (P = spending public key)
4. Recipient derives: p' = p + H(s·R) (p = spending private key, s = viewing private key)
```

### Encryption

**XChaCha20-Poly1305** for viewing key encrypted data:
- 256-bit key, 192-bit nonce
- AEAD providing confidentiality and authenticity
- Nonce reuse resistant due to extended nonce size

## Key Security

### Key Types

| Key | Purpose | Exposure Risk |
|-----|---------|---------------|
| **Spending Private Key** | Sign transactions, derive stealth keys | Critical - full fund access |
| **Viewing Private Key** | Decrypt payment notifications | Medium - reveals transaction history |
| **Spending Public Key** | Part of stealth meta-address | Safe to share |
| **Viewing Public Key** | Part of stealth meta-address | Safe to share |

### Key Derivation

- Stealth private keys derived deterministically from spending key + shared secret
- BIP-32 compatible for HD wallet integration
- Keys never transmitted; only derived locally

### Secure Key Handling

The SDK follows these principles:

1. **No Key Logging**: Private keys are never logged (redacted in structured logs)
2. **Memory Clearing**: Keys cleared from memory after use where possible
3. **No Plaintext Storage**: CLI exports keys with restricted file permissions (0600)
4. **Input Validation**: All key inputs validated before use

## API Security

### Rate Limiting

- Default: 100 requests/minute per IP
- Configurable per deployment
- Exponential backoff on repeated violations

### Authentication

- API keys for service-to-service communication
- Wallet signatures for user authentication
- No plaintext credentials in URLs or logs

### CORS Policy

- Configurable allowed origins
- Credentials require explicit opt-in
- Preflight caching for performance

## Known Limitations

### Current Limitations

1. **No Network Privacy**: Transactions visible to RPC providers (Tor/SOCKS5 support planned for M17)
2. **JavaScript Environment**: Browser/Node.js limitations for secure memory handling
3. **No Hardware Wallet ZK**: Proof generation requires software signing
4. **Single Backend at a Time**: No concurrent multi-backend settlement yet

### Planned Improvements

- **M17**: Network privacy layer (Tor/SOCKS5 proxy support)
- **M19-M21**: Proof composition for enhanced privacy guarantees
- **Future**: Hardware wallet integration for key operations

## Security Best Practices

For users of SIP Protocol:

1. **Key Management**
   - Use hardware wallets for significant funds
   - Never share private keys or seed phrases
   - Keep viewing keys separate from spending keys

2. **Operational Security**
   - Verify URLs before connecting wallets
   - Keep software updated
   - Use unique addresses for each transaction

3. **For Developers**
   - Never log private keys
   - Validate all inputs at API boundaries
   - Use environment variables for sensitive configuration
   - Review dependencies for supply chain security

## Scope

### In Scope

- `@sip-protocol/sdk`
- `@sip-protocol/react`
- `@sip-protocol/cli`
- `@sip-protocol/api`
- `@sip-protocol/types`
- `sip-website`
- `sip-app`
- `docs-sip`

### Out of Scope

- Third-party dependencies (report to maintainers)
- Social engineering attacks
- Denial of service attacks
- Physical access attacks
- Bugs in underlying blockchains

## Bug Bounty

Coming soon. Details will be announced at https://sip-protocol.org/security

## Acknowledgments

We thank the security researchers who have helped improve SIP Protocol:

- (Your name could be here)

---

*Last updated: January 2026*
