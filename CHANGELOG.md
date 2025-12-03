# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Deprecation warnings for legacy methods scheduled for removal in v0.2.0

### Deprecated
- `createCommitment()` in `@sip-protocol/sdk` - Use `commit()` from `./commitment` instead
- `verifyCommitment()` in `@sip-protocol/sdk` - Use `verifyOpening()` from `./commitment` instead
- `generateShieldedAddress()` in `ZcashRPCClient` - Use `createAccount()` and `getAddressForAccount()` instead

## [0.1.0] - 2025-11-27

### Added
- Initial release of SIP Protocol SDK
- Stealth address generation (EIP-5564 style)
- Pedersen commitments with homomorphic properties
- Viewing keys for selective disclosure
- Privacy levels: transparent, shielded, compliant
- NEAR Intents adapter integration
- Zcash RPC client with shielded transaction support
- Wallet adapters (abstract interface + Solana/Ethereum)
- Comprehensive test suite (1,293 tests)
- ZK proof specifications and mock implementations

### Security
- Implemented cryptographic primitives using @noble/curves
- Added input validation at all system boundaries
- Secure random number generation for blinding factors

---

## Deprecation Policy

Methods marked as deprecated will:
1. Display console warnings when called
2. Continue to function normally in current version
3. Be removed in the next minor version (v0.2.0)
4. Have migration paths documented in `docs/API-MIGRATION.md`

**Removal Timeline:**
- **v0.1.x**: Deprecated methods work with warnings
- **v0.2.0**: Deprecated methods removed (breaking change)

For migration guidance, see [API Migration Guide](docs/API-MIGRATION.md).
