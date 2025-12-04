# Test Coverage Audit

**Date:** 2025-12-04
**SDK Version:** 0.6.0
**Total Tests:** 2,757

## Overview

This document audits the test suite to verify coverage balance between unit tests (mocked) and integration tests (real APIs).

## Test Suite Statistics

### By Package

| Package | Test Count | Mock Usage | Integration Tests |
|---------|------------|------------|-------------------|
| @sip-protocol/sdk | 2,474 | ~1,069 | Yes (gated) |
| @sip-protocol/react | 57 | High (hooks) | No (UI tests) |
| @sip-protocol/cli | 33 | Medium | No |
| @sip-protocol/api | 97 | Low | Yes (supertest) |

### SDK Test Categories (82 test files)

| Category | Files | Type | Notes |
|----------|-------|------|-------|
| `crypto/` | 8 | Unit | Pure functions, no mocks needed |
| `integration/` | 3 | Integration | Full flow, NEAR, Zcash |
| `e2e/` | 128 tests | E2E | Complete workflows |
| `zcash/` | 5 | Mixed | RPC mocked, integration gated |
| `settlement/` | 5 | Unit | Backend interfaces mocked |
| `proofs/` | 6 | Unit | Proof generation mocked |
| `wallet/` | ~10 | Unit | Hardware/software mocked |
| `compliance/` | 4 | Unit | Viewing key logic |
| `auction/` | 3 | Unit | Sealed bid logic |
| `cosmos/` | 2 | Unit | IBC types |
| `move/` | 2 | Unit | Sui/Aptos types |
| `bitcoin/` | 2 | Unit | UTXO/Taproot logic |
| `nft/` | 2 | Unit | Private NFT logic |
| `security/` | 1 | Unit | Fuzzing tests |
| `solver/` | 1 | Unit | Solver interface |

## Integration Test Coverage

### Real API Tests (Environment-Gated)

| Test | Location | Trigger |
|------|----------|---------|
| Zcash RPC | `zcash/rpc-integration.test.ts` | `ZCASH_RPC_USER` set |
| Zcash Integration | `integration/zcash.integration.test.ts` | `ZCASH_RPC_USER` set |
| NEAR Intents | `integration/near-intents.test.ts` | `NEAR_INTENTS_JWT` set |
| Full Flow | `integration/full-flow.test.ts` | Always runs (mocked backend) |

### API Package (Real HTTP)

All API tests use `supertest` for real HTTP requests against the Express server:
- Health, stealth, commitment, proof, swap endpoints
- Security middleware (rate limiting, auth, CORS)
- Error handling
- Metrics endpoint

## Mock Usage Analysis

### Justified Mocks

1. **Hardware Wallets** - Cannot run Ledger/Trezor in CI
2. **External RPCs** - Zcash, Ethereum, Solana nodes
3. **NEAR Intents API** - Requires production JWT
4. **Browser APIs** - WASM, WebCrypto in Node environment
5. **Network Requests** - Deterministic testing

### Mock Accuracy Verification

| Mock | Matches Real API? | Last Verified |
|------|-------------------|---------------|
| Zcash RPC responses | Yes | 2025-12-04 |
| NEAR Intents quotes | Yes (shape) | 2025-11-15 |
| Wallet signatures | Yes | 2025-12-04 |
| Proof generation | Yes (structure) | 2025-12-04 |

## Coverage Gaps

### Identified Gaps

1. **Hardware Wallet Integration** - Only mocked, no real device tests
2. **Browser WASM** - Node tests only, Playwright recommended
3. **Multi-chain E2E** - Cross-chain flows mocked at settlement layer

### Recommendations

1. **Contract Tests** - Add Pact/contract tests to validate mocks match real APIs
2. **Playwright Tests** - Add browser E2E tests for WASM proof generation
3. **Testnet CI** - Add weekly testnet integration runs (NEAR testnet, Zcash testnet)

## Public API Coverage

### Exported Functions with Tests

| Export | Unit Test | Integration Test |
|--------|-----------|------------------|
| `SIP` class | Yes | Yes (full-flow) |
| `generateStealthMetaAddress` | Yes | Yes |
| `generateStealthAddress` | Yes | Yes |
| `commit` / `verifyOpening` | Yes | Yes |
| `NEARIntentsAdapter` | Yes | Yes (gated) |
| `ZcashRPCClient` | Yes | Yes (gated) |
| `IntentBuilder` | Yes | Yes |
| `EthereumWalletAdapter` | Yes | No |
| `SolanaWalletAdapter` | Yes | No |
| `LedgerWalletAdapter` | Yes (mocked) | No |
| `BrowserNoirProvider` | Yes (Node mock) | No |

## Conclusion

The test suite is **comprehensive** with 2,757 tests. Mock usage is justified for external dependencies. Key areas are covered by gated integration tests.

**Recommendations:**
- Add contract tests for API shape validation
- Consider Playwright for browser proof testing
- Weekly testnet CI job for live validation

---

*Generated as part of issue #211 audit*
