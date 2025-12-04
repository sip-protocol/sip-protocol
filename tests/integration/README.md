# Integration Test Suite

Comprehensive end-to-end tests verifying all packages work together correctly.

## Overview

This test suite validates integration between:
- `@sip-protocol/sdk` - Core cryptographic functions
- `@sip-protocol/react` - React hooks
- `@sip-protocol/cli` - Command-line interface
- `@sip-protocol/api` - REST API service

## Test Structure

```
tests/integration/
├── vitest.config.ts       # Integration test configuration
├── setup.ts               # Test utilities, mocks, and fixtures
├── sdk-react.test.ts      # SDK + React hooks (11 tests)
├── sdk-cli.test.ts        # SDK + CLI commands (16 tests)
├── sdk-api.test.ts        # SDK + REST API (16 tests)
└── full-flow.test.ts      # Complete swap flows (10 tests)
```

## Running Tests

```bash
# Run all integration tests
pnpm test:integration

# Watch mode
pnpm test:integration:watch

# Verbose output
VERBOSE=1 pnpm test:integration
```

## Test Coverage

### SDK + React Integration (sdk-react.test.ts)
- ✓ Stealth address generation via hooks
- ✓ Address regeneration from meta-address
- ✓ Ed25519 chain support (Solana)
- ✓ Viewing key encryption/decryption
- ✓ SIP client initialization
- ✓ Private swap execution
- ✗ Some React rendering issues (needs jsdom environment)

**Status**: 0/11 passing (environment config needed)

### SDK + CLI Integration (sdk-cli.test.ts)
- ✓ Key generation (secp256k1 and ed25519)
- ✓ Commitment creation
- ✓ Proof generation
- ✓ Commitment verification
- ✓ Error handling
- ✓ Output format validation
- ✗ Some CLI output format mismatches

**Status**: 11/16 passing (68.75%)

### SDK + REST API Integration (sdk-api.test.ts)
- ✓ Health check endpoint
- ✓ Stealth address generation
- ✓ Commitment creation
- ✓ Proof generation endpoints
- ✓ Error handling (404, 400)
- ✓ SDK consistency validation
- ✗ Some endpoint validation issues
- ✗ One test timeout issue

**Status**: 11/16 passing (68.75%)

### Full Flow Integration (full-flow.test.ts)
- ✓ Cross-package integration
- ✓ SDK commitment in API flow
- ✗ Complete private swap flow (address format issues)
- ✗ Transparent swap (IntentBuilder API mismatch)
- ✗ Compliant swap (viewing key function missing)
- ✗ Multi-chain flows (Solana/NEAR address formats)
- ✗ Error handling scenarios

**Status**: 1/10 passing (10%)

## Overall Results

**Total**: 23/53 tests passing (43.4%)

## Known Issues

### 1. React Hook Tests (sdk-react.test.ts)
**Issue**: `document is not defined` error
**Cause**: Tests require jsdom environment for React Testing Library
**Fix**: Update vitest config to use jsdom for React tests
```ts
environment: 'jsdom'  // for React tests
```

### 2. Stealth Address Format (full-flow.test.ts, sdk-api.test.ts)
**Issue**: Expected Ethereum address (40 hex chars), got secp256k1 public key (66 hex chars)
**Example**:
```
Expected: /^0x[0-9a-f]{40}$/i
Received: "0x03f43bd86afb5610fa06578a..."  // 66 chars (compressed public key)
```
**Cause**: `generateStealthAddress()` returns raw public key, not Ethereum address
**Fix**: Convert secp256k1 public key to Ethereum address (Keccak256 hash last 20 bytes)

### 3. Viewing Key API (full-flow.test.ts)
**Issue**: `generateViewingKeyPair is not a function`
**Cause**: Function not exported from SDK index
**Fix**: Export `generateViewingKeyPair` from `@sip-protocol/sdk`

### 4. IntentBuilder API (full-flow.test.ts)
**Issue**: `.setSourceChain is not a function`
**Cause**: IntentBuilder may have different API or not exported
**Fix**: Verify IntentBuilder export and API in SDK

### 5. CLI Output Format (sdk-cli.test.ts)
**Issue**: Expected output patterns not matching
**Examples**:
- Missing "PRIVATE KEYS" in keygen output
- Proof framework output format difference
**Fix**: Update CLI output formatting or adjust test expectations

### 6. API Validation (sdk-api.test.ts)
**Issue**: Quote endpoints returning 400 instead of 200
**Cause**: Missing required fields or validation schema mismatch
**Fix**: Review API validation schemas and required fields

### 7. Solana Address Format (full-flow.test.ts)
**Issue**: Expected base58, got hex format
**Example**:
```
Expected: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/  (base58)
Received: "0x45e71126..."  (hex)
```
**Cause**: Ed25519 stealth address not converting to base58
**Fix**: Convert ed25519 public key to Solana base58 address format

## Test Utilities

### Fixtures (setup.ts)
```ts
TEST_FIXTURES = {
  privateKey: '0x' + '01'.repeat(32),
  spendingKey: '0x02...',
  viewingKey: '0x03...',
  stealthAddress: 'sip:eth:...',
  amount: BigInt(1000000),
}
```

### Mocks
- `MockSettlementBackend` - Simulates quote/intent submission
- `mockNearIntents` - NEAR adapter mock
- `mockZcashRpc` - Zcash RPC mock
- `createMockApiServer()` - API server helper

### Helpers
- `execCli(args)` - Execute CLI commands
- `startApiServer()` / `stopApiServer()` - API server lifecycle
- `generateRandomHex(length)` - Random hex generator
- `wait(ms)` - Promise delay

## Next Steps

1. **Fix React Environment** (High Priority)
   - Update vitest config to use jsdom for React tests
   - Add `@testing-library/react` setup

2. **Fix Stealth Address Formats** (High Priority)
   - Ethereum: Convert secp256k1 → Ethereum address (Keccak256)
   - Solana: Convert ed25519 → base58 address

3. **Export Missing Functions** (High Priority)
   - Export `generateViewingKeyPair` from SDK
   - Verify `IntentBuilder` export and API

4. **Update CLI Output** (Medium Priority)
   - Standardize CLI output formatting
   - Add consistent success messages

5. **Fix API Validation** (Medium Priority)
   - Review quote endpoint validation
   - Add missing required fields
   - Update schemas

6. **Expand Test Coverage** (Low Priority)
   - Add more error scenarios
   - Test more privacy levels
   - Add performance benchmarks

## Contributing

When adding new integration tests:

1. Add test file to `tests/integration/`
2. Use existing fixtures from `setup.ts`
3. Follow naming convention: `sdk-{package}.test.ts`
4. Update this README with test counts
5. Run full suite before committing

## CI/CD

Integration tests should run on:
- Pull requests (before merge)
- Main branch commits
- Nightly builds

**Timeout**: 60s per test, 30s per hook

## References

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [SIP SDK Documentation](../../packages/sdk/README.md)
- [SIP API Documentation](../../packages/api/README.md)
