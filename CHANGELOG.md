# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2025-12-03

### Added - M14: Developer Experience

#### New Packages
- **@sip-protocol/react** - React hooks for SIP integration
  - `SIPProvider` - Context provider for SIP client
  - `useSIP()` - Access SIP client instance
  - `useStealthAddress()` - Generate stealth addresses
  - `usePrivateSwap()` - Execute private swaps with status tracking
  - `useViewingKey()` - Manage viewing keys for compliance
- **@sip-protocol/cli** - Command-line interface
  - `sip init` - Initialize configuration
  - `sip keygen` - Generate stealth meta-address
  - `sip commit` - Create Pedersen commitment
  - `sip prove` - Generate ZK proofs (funding/validity)
  - `sip verify` - Verify proofs
  - `sip quote` / `sip swap` - Get quotes and execute swaps
  - `sip scan` - Scan for stealth payments
- **@sip-protocol/api** - REST API service
  - Express.js server with Zod validation
  - Endpoints: stealth/generate, commitment/create, proof/funding, quote, swap
  - Docker-ready deployment

#### Documentation
- **TypeDoc JSDoc** - Comprehensive API documentation (474 exports)
- **SDK Cookbook** - 10 practical recipes in docs-sip
- **Error Handling Guide** - 62 error codes documented
- **React Native Research** - Feasibility study for mobile SDK

#### Integration Tests
- 53 new integration tests across all packages
- SDK + React, SDK + CLI, SDK + API test suites

### Changed
- 72 new files added
- 10,279 lines of new code
- 41 React tests + 53 integration tests

### Issues Closed
- #169: Create @sip-protocol/react package
- #170: Implement useSIP hook
- #171: Implement useStealthAddress hook
- #172: Implement usePrivateSwap hook
- #173: Implement useViewingKey hook
- #174: Create @sip-protocol/cli package
- #175: Create REST API service package
- #176: Add comprehensive TypeDoc documentation
- #177: Research React Native SDK support
- #178: Create SDK cookbook/recipes documentation
- #179: Add error handling best practices guide
- #180: Create integration test suite

## [0.5.1] - 2025-12-03

### Fixed
- **CI flaky test** - Added timing tolerance for latency test in Cosmos mock adapter
- **TypeScript build** - Fixed variable initialization in derivation.ts

## [0.5.0] - 2025-12-03

### Added - M13: Compliance & Enterprise

#### Compliance Reporting
- **ComplianceReporter** - Generate audit reports from viewing keys
- **JSON export** - Decrypted transaction reports with summary statistics
- **PDF export** - Professional formatted audit reports (lightweight, no deps)
- **FATF Travel Rule export** - Cross-border transfer format
- **FINCEN SAR export** - US regulatory format
- **CSV export** - Generic comma-separated values

#### Threshold & Conditional Disclosure
- **Threshold viewing keys** - N-of-M Shamir's Secret Sharing
- **Time-locked disclosure** - Auto-reveal after specified time/block
- **Amount threshold disclosure** - Range proofs for regulatory reporting

#### Enterprise Features
- **Auditor key derivation** - BIP-44 style paths (PRIMARY, REGULATORY, INTERNAL, TAX)
- **ComplianceManager dashboard API** - Metrics, auditor list, disclosure history

### Changed
- 7 new compliance source files added
- 264 new tests (2,025 → 2,289 total)
- Full compliance module with enterprise features

### Issues Closed
- #161: Audit report generation (JSON format)
- #162: PDF export for audit reports
- #163: Regulatory export formats (FATF, FINCEN)
- #164: Threshold viewing keys (N-of-M)
- #165: Time-locked disclosure
- #166: Amount threshold disclosure
- #167: Auditor key derivation paths
- #168: Dashboard data API

## [0.4.0] - 2025-12-03

### Added - M12: Multi-Chain Expansion

#### Bitcoin Support
- **Taproot (BIP-340/341)** - Schnorr signatures, x-only pubkeys, Bech32m addresses
- **Silent Payments (BIP-352)** - Privacy-preserving Bitcoin payments without interaction
- **Bitcoin wallet adapter** - Unisat integration with PSBT signing, BIP-322 messages

#### Cosmos Ecosystem
- **Cosmos stealth addresses** - secp256k1 with bech32 encoding for 6 chains
- **IBC stealth transfers** - Cross-chain privacy via IBC memo field
- **Cosmos wallet adapter** - Keplr integration with Amino/Direct signing
- **Supported chains**: Cosmos Hub, Osmosis, Injective, Celestia, Sei, dYdX

#### Move Chains (Aptos/Sui)
- **Aptos stealth addresses** - ed25519 with SHA3-256 address derivation
- **Sui stealth addresses** - ed25519 with BLAKE2b-256 address derivation
- **Move wallet adapters** - Petra (Aptos) and Sui Wallet integration

### Changed
- 38 new source files added
- 208 new tests (1,817 → 2,025 total)
- 7 new chain integrations
- 4 new wallet adapters

### Issues Closed
- #152: Bitcoin Silent Payments (BIP-352)
- #153: Taproot support for Bitcoin
- #154: Bitcoin wallet adapter
- #155: Cosmos stealth addresses
- #156: Cosmos IBC stealth transfers
- #157: Cosmos wallet adapter
- #158: Aptos stealth addresses
- #159: Sui stealth addresses
- #160: Move wallet adapters

## [0.3.2] - 2025-12-03

### Security
- **slippageTolerance validation** - Added bounds checking (0-10000 basis points) to prevent negative minOutputAmount calculations
- 4 new test cases for slippage validation edge cases

## [0.3.1] - 2025-12-03

### Added
- **Web Worker proof generation** - Validity and fulfillment proofs via dedicated workers
- **Fail-fast bridge validation** - Early validation before API calls in NEAR Intents adapter
- **Mock prices documentation** - Comprehensive docs for testing scenarios

### Fixed
- Minor bug fixes and documentation improvements

## [0.3.0] - 2025-12-03

### Added - M11: Multi-Settlement

#### Settlement Abstraction Layer
- **SettlementBackend interface** - Pluggable backend abstraction for multi-settlement support
- **SettlementRegistry** - Backend management with route-based selection
- **SmartRouter** - Intelligent route selection with fee/speed/privacy ranking

#### Settlement Backends
- **NEARIntentsBackend** - Refactored NEAR 1Click adapter implementing SettlementBackend
- **ZcashNativeBackend** - Native ZEC→ZEC transfers with shielded address support
- **DirectChainBackend** - Same-chain private transfers (ETH→ETH, SOL→SOL, etc.)

#### Research
- THORChain integration feasibility study (`docs/specs/THORCHAIN-RESEARCH.md`)

### Changed
- Settlement module: 2,683 lines of code
- 143 new tests added (1,628 total SDK tests)

## [0.2.10] - 2025-12-03

### Added - M10: ZK Production
- **BrowserNoirProvider** - Browser-based Noir proof generation with WASM
- **Mobile WASM support** - iOS Safari, Chrome Android, Firefox Mobile detection
- Mobile compatibility utilities (`getMobileDeviceInfo`, `checkMobileWASMCompatibility`)
- SharedArrayBuffer and COOP/COEP header detection
- Noir upgrade to beta.16

### Changed
- Updated @noir-lang/noir_js to 1.0.0-beta.16
- Updated @noir-lang/types to 1.0.0-beta.16

## [0.2.0] - 2025-12-01

### Added
- Noir proof provider with mock implementation
- ProofProvider interface for ZK proof abstraction
- E2E test suite (128 tests)
- Integration tests for cross-chain swaps

### Removed
- Deprecated `createCommitment()` - Use `commit()` from `./commitment`
- Deprecated `verifyCommitment()` - Use `verifyOpening()` from `./commitment`
- Deprecated `generateShieldedAddress()` in ZcashRPCClient

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

## Version History

| Version | Date | Milestone | Highlights |
|---------|------|-----------|------------|
| 0.6.0 | 2025-12-03 | M14 | React hooks, CLI, REST API, docs |
| 0.5.1 | 2025-12-03 | Bugfix | CI test fix, TypeScript build fix |
| 0.5.0 | 2025-12-03 | M13 | Compliance, threshold keys, enterprise |
| 0.4.0 | 2025-12-03 | M12 | Bitcoin, Cosmos, Aptos, Sui chains |
| 0.3.2 | 2025-12-03 | Security | slippageTolerance validation fix |
| 0.3.1 | 2025-12-03 | Bugfix | Web Workers, fail-fast validation, docs |
| 0.3.0 | 2025-12-03 | M11 | Settlement abstraction, SmartRouter, 3 backends |
| 0.2.10 | 2025-12-03 | M10 | Noir circuits, browser WASM, mobile support |
| 0.2.0 | 2025-12-01 | M8 | Proof providers, E2E tests |
| 0.1.0 | 2025-11-27 | M1-M7 | Initial release, core cryptography |
