# React Native SDK Feasibility Study

**Date:** 2025-12-03
**Status:** Research Complete
**Issue:** #177
**Verdict:** FEASIBLE with Native Approach (High Complexity)

---

## Executive Summary

React Native support for the SIP Protocol SDK is **feasible but requires significant architectural adaptations**. The core challenge is that **WASM does not run natively in React Native's Hermes engine**, requiring either:

1. **Native Modules Approach** (Recommended) - Use native bindings for ZK proofs
2. **Polyfill Approach** (Limited) - JavaScript-only crypto with no ZK proofs

The @noble cryptographic libraries (curves, hashes, ciphers) work in React Native with minimal polyfills, but Noir WASM circuits require native module integration.

**Recommendation:** Implement a React Native SDK using native modules (Mopro framework) for ZK proof generation, with @noble libraries for cryptographic primitives.

---

## 1. Cryptographic Library Compatibility

### 1.1 @noble/curves

| Aspect | Status | Notes |
|--------|--------|-------|
| **Core Compatibility** | ✅ WORKS | Supports all major platforms including React Native |
| **Polyfill Required** | `react-native-get-random-values` | For `crypto.getRandomValues()` |
| **secp256k1 Support** | ✅ FULL | Used for stealth addresses (EIP-5564) |
| **Performance** | ✅ GOOD | Pure JavaScript, no native code required |

**Setup:**
```javascript
import 'react-native-get-random-values'
import { secp256k1 } from '@noble/curves/secp256k1'
```

**Known Issues:**
- Module export warnings: "Attempted to import module not listed in 'exports'" (non-blocking)
- Requires polyfill before any crypto operations

**Sources:**
- [@noble/curves npm](https://www.npmjs.com/package/@noble/curves)
- [GitHub - paulmillr/noble-curves](https://github.com/paulmillr/noble-curves)

---

### 1.2 @noble/hashes

| Aspect | Status | Notes |
|--------|--------|-------|
| **Core Compatibility** | ✅ WORKS | SHA-256, BLAKE, RIPEMD supported |
| **Polyfill Required** | `react-native-get-random-values` | For random functions |
| **Performance** | ✅ GOOD | Pure JavaScript implementation |
| **Weekly Downloads** | 15.5M+ | Battle-tested, widely used |

**Known Issues (2025):**
- Node.js module warnings: Attempts to import `node:buffer` cause warnings
- `@noble/hashes/crypto.js` export path warnings (non-blocking)

**Workaround:**
- Use `react-native-quick-crypto` for better performance
- Or accept JavaScript-only with polyfill

**Sources:**
- [@noble/hashes npm](https://www.npmjs.com/package/@noble/hashes)
- [GitHub - paulmillr/noble-hashes](https://github.com/paulmillr/noble-hashes)

---

### 1.3 @noble/ciphers

| Aspect | Status | Notes |
|--------|--------|-------|
| **Core Compatibility** | ✅ WORKS | XChaCha20-Poly1305 supported |
| **Polyfill Required** | `react-native-get-random-values` | For encryption nonces |
| **Performance** | ✅ EXCELLENT | 468,384 ops/sec for XChaCha20-Poly1305 |
| **Used in SIP** | Privacy encryption, viewing keys | |

**Benchmark (64B data, 2025):**
- `xchacha20poly1305`: 468,384 ops/sec @ 2μs/op
- `xchacha20` (unauthenticated): 1,404,494 ops/sec @ 712ns/op

**Sources:**
- [@noble/ciphers npm](https://www.npmjs.com/package/@noble/ciphers)
- [GitHub - paulmillr/noble-ciphers](https://github.com/paulmillr/noble-ciphers)

---

### 1.4 Summary: Crypto Library Compatibility

| Library | RN Compatible | Polyfill | Performance | Verdict |
|---------|---------------|----------|-------------|---------|
| @noble/curves | ✅ Yes | `react-native-get-random-values` | Good | READY |
| @noble/hashes | ✅ Yes | `react-native-get-random-values` | Good | READY |
| @noble/ciphers | ✅ Yes | `react-native-get-random-values` | Excellent | READY |

**All three @noble libraries work in React Native with minimal setup.**

---

## 2. Noir WASM Compatibility

### 2.1 Core Problem: WASM Not Supported in Hermes

**React Native 0.82+ (2025):**
- Default engine: **Hermes** (optimized for mobile)
- Hermes does **NOT** support `WebAssembly` global
- JSC (JavaScriptCore) alternative also has limited WASM support

**Quote from research:**
> "At present it does not look like Hermes has support for running WASM via a global.WebAssembly. This has been a long-standing issue tracked on GitHub."

**Sources:**
- [Using Hermes - React Native](https://reactnative.dev/docs/hermes)
- [WASM support within Hermes? - Issue #429](https://github.com/facebook/hermes/issues/429)

---

### 2.2 Polyfill Approach (Not Recommended)

**Option:** Use `react-native-wasm` polyfill library

**Drawbacks:**
- "JS-only polyfills bringing WebAssembly support into the runtime are bound to be slow"
- Incomplete WebAssembly API implementation
- Performance penalty makes ZK proofs impractical
- Not production-ready for heavy computation

**Sources:**
- [GitHub - inokawa/react-native-wasm](https://github.com/inokawa/react-native-wasm)

---

### 2.3 Native Modules Approach (Recommended)

**Solution:** Use native bindings instead of WASM

#### Mopro Framework (ZK Proofs on Mobile)

**What is Mopro?**
- Mobile prover toolkit for ZK proofs (Circom, Noir)
- Native bindings for iOS (Swift), Android (Kotlin), React Native, Flutter
- Uses `noir_rs` (Rust) to interface with Barretenberg
- **10× performance boost** compared to browser WASM

**Performance Benchmarks:**
- Tested on iPhone 15 Pro (2023)
- Keccak256: Native performance
- RSA signature verification: ~7% faster than browser
- Anon Aadhaar circuit: 3957ms (Mopro) vs 4220ms (browser)

**React Native Integration:**
- Template: [madztheo/noir-react-native-starter](https://github.com/madztheo/noir-react-native-starter)
- Latest Noir: 1.0.0-beta.8
- Barretenberg: 1.0.0-nightly.20250723
- Requires SRS (Structured Reference String) from Aztec Universal Trusted Setup

**Alternative Native Libraries:**
- **Swoir**: iOS-specific Noir wrapper (Swift)
- **Noirandroid**: Android-specific Noir wrapper (Kotlin)
- **noir_rs**: Rust crate for cross-platform proving

**Sources:**
- [Mopro Documentation](https://zkmopro.org/docs/intro/)
- [Mopro x Noir Integration](https://zkmopro.org/blog/noir-integraion/)
- [Mopro Performance Benchmarks](https://zkmopro.org/docs/performance/)
- [noir-react-native-starter](https://github.com/madztheo/noir-react-native-starter)

---

### 2.4 Architecture Comparison

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **WASM Polyfill** | Easy setup, no native code | Slow, incomplete API, not production-ready | ❌ NOT VIABLE |
| **Native Modules (Mopro)** | 10× faster, production-ready, full Noir support | Complex setup, larger binary size, platform-specific builds | ✅ RECOMMENDED |
| **No ZK Proofs** | Simple, crypto-only SDK | No funding/validity/fulfillment proofs | ⚠️ LIMITED USE CASE |

---

## 3. Native Module Requirements

### 3.1 What Needs Native Code?

| Component | Native Required? | Reason |
|-----------|------------------|--------|
| @noble/curves | ❌ No | Pure JavaScript |
| @noble/hashes | ❌ No | Pure JavaScript |
| @noble/ciphers | ❌ No | Pure JavaScript |
| Noir Proof Generation | ✅ YES | WASM not supported in Hermes |
| Secure Key Storage | ✅ YES | OS-level keychain/keystore |
| Random Number Generation | ⚠️ Optional | Can use polyfill or native (faster) |

---

### 3.2 Crypto Polyfill Options

**Option 1: react-native-get-random-values (Lightweight)**
- Small library (890K+ weekly downloads)
- Only provides `crypto.getRandomValues()`
- Uses `SecureRandom` (Android) and `SecRandomCopyBytes` (iOS)

**Setup:**
```javascript
import 'react-native-get-random-values'
// Now @noble libraries work
```

**Option 2: react-native-quick-crypto (Full Crypto)**
- Fast C/C++ JSI implementation
- Drop-in replacement for Node.js `crypto` module
- Much faster than JavaScript polyfills
- Larger binary size (~2MB)

**Setup:**
```javascript
import { install } from 'react-native-quick-crypto'
install() // Polyfills global.crypto and global.Buffer
```

**Sources:**
- [react-native-get-random-values npm](https://www.npmjs.com/package/react-native-get-random-values)
- [react-native-quick-crypto GitHub](https://github.com/margelo/react-native-quick-crypto)
- [Callstack Blog - Native Crypto Libraries](https://www.callstack.com/blog/increase-speed-and-security-with-native-crypto-libraries)

---

### 3.3 Secure Storage for Private Keys

**expo-secure-store (Recommended for Expo projects)**

| Platform | Implementation | Security |
|----------|---------------|----------|
| **iOS** | Keychain Services (`kSecClassGenericPassword`) | Hardware-backed encryption |
| **Android** | SharedPreferences + Android Keystore | Hardware-backed encryption |

**Features:**
- Persistent across app restarts and updates
- Encrypted at rest
- Biometric authentication support
- Auto-excludes from Android Auto Backup
- Easy API: `SecureStore.setItemAsync()`, `SecureStore.getItemAsync()`

**Important iOS Behavior:**
> "Due to the underlying nature of iOS Keychain, data stored with expo-secure-store will persist across app uninstallations when the app is reinstalled with the same bundle ID."

**Usage:**
```javascript
import * as SecureStore from 'expo-secure-store'

// Store private key
await SecureStore.setItemAsync('sip_spending_key', spendingKey)

// Retrieve private key
const key = await SecureStore.getItemAsync('sip_spending_key')
```

**Sources:**
- [Expo SecureStore Documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [LogRocket - Expo SecureStore Tutorial](https://blog.logrocket.com/encrypted-local-storage-in-react-native/)

---

## 4. Expo Compatibility

### 4.1 Managed vs Bare Workflow

| Workflow | Definition | Pros | Cons | Verdict for SIP |
|----------|-----------|------|------|-----------------|
| **Managed** | Expo Go app, no native code | Fast iteration, easy setup | Limited native modules, no custom native code | ❌ NOT VIABLE (needs Mopro) |
| **Bare** | Ejected to native projects | Full native module support, custom builds | Slower iteration, requires Xcode/Android Studio | ✅ REQUIRED |

**Why Bare Workflow?**
- Mopro requires native bindings (Swift, Kotlin)
- Custom React Native module for Noir proof generation
- Need to bundle SRS (Structured Reference String) in app

---

### 4.2 Expo Crypto Features

**expo-crypto (Available in both workflows)**

| Feature | Support | Notes |
|---------|---------|-------|
| `getRandomValues()` | ✅ Full | Cryptographically secure random |
| `randomUUID()` | ✅ Full | V4 UUID generation |
| `digestStringAsync()` | ✅ Full | SHA-256, SHA-512 hashing |
| XChaCha20 | ❌ No | Use @noble/ciphers instead |

**Sources:**
- [Expo Crypto Documentation](https://docs.expo.dev/versions/latest/sdk/crypto/)

---

### 4.3 Config Plugins

For bare workflow, create an Expo config plugin to:
1. Link Mopro native modules
2. Bundle circuit artifacts and SRS
3. Configure Metro bundler for React Native packages

**Example:**
```javascript
// app.json
{
  "expo": {
    "plugins": [
      "@sip-protocol/expo-plugin" // Custom plugin for SIP SDK
    ]
  }
}
```

---

## 5. Architecture Proposal for React Native SDK

### 5.1 Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  @sip-protocol/sdk-react-native (TypeScript)                    │
│  • High-level API (same interface as @sip-protocol/sdk)         │
│  • StealthAddress, Commitment, ViewingKey, IntentBuilder        │
│  • Uses @noble/curves, @noble/hashes, @noble/ciphers            │
└────────────────────┬────────────────────────────────────────────┘
                     │ Uses
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  @sip-protocol/proof-provider-rn (React Native Module)          │
│  • Native module wrapping Mopro                                 │
│  • Implements ProofProvider interface                           │
│  • Methods: generateFundingProof(), generateValidityProof()     │
└────────────────────┬────────────────────────────────────────────┘
                     │ Wraps
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Mopro Framework (Native - Swift/Kotlin)                        │
│  • Noir circuit execution                                       │
│  • Barretenberg backend                                         │
│  • Native performance (10× browser speed)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.2 Package Structure

```
sip-protocol/
├── packages/
│   ├── sdk/                      # Core SDK (Node/Browser)
│   ├── sdk-react-native/         # NEW: React Native SDK
│   │   ├── src/
│   │   │   ├── index.ts          # Main exports
│   │   │   ├── sip.ts            # SIP client (RN-specific)
│   │   │   ├── crypto.ts         # @noble wrappers
│   │   │   └── proofs/
│   │   │       └── native.ts     # Native module bridge
│   │   ├── ios/                  # Swift native code
│   │   │   └── SIPProofs.swift   # Mopro wrapper
│   │   ├── android/              # Kotlin native code
│   │   │   └── SIPProofs.kt      # Mopro wrapper
│   │   ├── circuits/             # Compiled Noir circuits
│   │   │   └── srs/              # Structured Reference String
│   │   └── package.json
│   └── types/                    # Shared TypeScript types
```

---

### 5.3 API Design (Consistent with Core SDK)

**Goal:** Same API surface as `@sip-protocol/sdk` for easy migration

```typescript
// @sip-protocol/sdk-react-native
import { SIP, PrivacyLevel } from '@sip-protocol/sdk-react-native'
import { NativeProofProvider } from '@sip-protocol/sdk-react-native/proofs'

// Initialize with native proof provider
const sip = new SIP({
  network: 'mainnet',
  defaultPrivacy: PrivacyLevel.SHIELDED,
  proofProvider: new NativeProofProvider(), // Uses Mopro
})

// Same API as core SDK
const stealthAddr = await sip.createStealthAddress('solana', spendingKey)
const intent = await sip.createShieldedIntent({
  from: { chain: 'ethereum', asset: 'ETH', amount: 100n },
  to: { chain: 'solana', asset: 'SOL', amount: 10n },
  recipient: stealthAddr,
})
```

**Key Differences:**
- `NativeProofProvider` instead of `NoirProofProvider` (WASM)
- Proof generation happens in native thread (async)
- Progress callbacks for long-running proofs

---

### 5.4 Native Module Interface

```typescript
// src/proofs/native.ts
import { NativeModules } from 'react-native'

interface SIPProofsModule {
  generateFundingProof(params: string): Promise<string>
  generateValidityProof(params: string): Promise<string>
  generateFulfillmentProof(params: string): Promise<string>
  isInitialized(): Promise<boolean>
}

const { SIPProofs } = NativeModules as { SIPProofs: SIPProofsModule }

export class NativeProofProvider implements ProofProvider {
  async generateFundingProof(params: FundingProofParams): Promise<ProofResult> {
    const result = await SIPProofs.generateFundingProof(JSON.stringify(params))
    return JSON.parse(result)
  }

  // ... other methods
}
```

---

## 6. Estimated Effort

### 6.1 Complexity Assessment

| Task | Complexity | Estimated Effort | Dependencies |
|------|-----------|------------------|--------------|
| **1. Research & Planning** | Low | ✅ DONE | This document |
| **2. Setup React Native Package** | Low | 1-2 days | React Native, TypeScript |
| **3. Polyfill @noble Libraries** | Low | 1 day | `react-native-get-random-values` |
| **4. Mopro Integration (iOS)** | High | 5-7 days | Swift, Xcode, Mopro SDK, Noir circuits |
| **5. Mopro Integration (Android)** | High | 5-7 days | Kotlin, Android Studio, Mopro SDK |
| **6. Native Module Bridge** | Medium | 3-4 days | React Native Modules API |
| **7. API Parity with Core SDK** | Medium | 3-5 days | @sip-protocol/sdk, @sip-protocol/types |
| **8. Testing (Unit + E2E)** | Medium | 4-5 days | Jest, Detox, iOS/Android simulators |
| **9. Documentation** | Low | 2-3 days | Markdown, code examples |
| **10. CI/CD for Native Builds** | Medium | 2-3 days | GitHub Actions, Fastlane |

**Total Estimated Effort:** 25-35 developer days (5-7 weeks for 1 developer)

---

### 6.2 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Mopro API Changes** | Medium | Pin Mopro version, monitor releases |
| **Noir Circuit Updates** | Medium | Version lock circuits with SDK |
| **iOS/Android Build Issues** | High | Extensive testing on real devices |
| **Binary Size Increase** | Medium | Lazy-load circuits, optimize SRS |
| **Performance on Low-End Devices** | Medium | Benchmark on budget phones, show progress UI |
| **Hermes WASM Support Added** | Low | Would simplify (but unlikely soon) |

---

### 6.3 Maintenance Burden

**Ongoing:**
- Keep Mopro dependency updated
- Test on new React Native versions
- Maintain iOS and Android native code
- Update circuits when Noir/Barretenberg changes
- Handle platform-specific bugs

**Comparison:**
- Core SDK (Node/Browser): Low maintenance
- React Native SDK: Medium-High maintenance (2 platforms)

---

## 7. Recommended Approach

### 7.1 Two-Phase Rollout

#### Phase 1: Crypto-Only SDK (Minimal Viable)
**Timeline:** 1-2 weeks
**Scope:**
- Stealth addresses (@noble/curves)
- Commitments (@noble/curves)
- Viewing keys (@noble/ciphers)
- Intent builder (no proofs)

**Use Cases:**
- Privacy toggles in wallets
- Stealth address generation
- Encrypted metadata
- No ZK proof generation

**Dependencies:**
```json
{
  "dependencies": {
    "@noble/curves": "^1.3.0",
    "@noble/hashes": "^1.3.3",
    "@noble/ciphers": "^2.0.1",
    "react-native-get-random-values": "^1.11.0",
    "@sip-protocol/types": "^0.1.1"
  }
}
```

---

#### Phase 2: Full SDK with ZK Proofs (Production)
**Timeline:** 5-7 weeks
**Scope:**
- Everything from Phase 1
- Native proof generation (Mopro)
- Funding, Validity, Fulfillment proofs
- Full SIP Protocol support
- Expo bare workflow

**Dependencies:**
```json
{
  "dependencies": {
    "@sip-protocol/sdk-react-native": "^0.1.0",
    "mopro-react-native": "^1.0.0",
    "expo-secure-store": "^15.0.0",
    "react-native-quick-crypto": "^0.7.0" // Optional
  }
}
```

---

### 7.2 Managed vs Bare Workflow Decision

| Workflow | Recommended For | SIP Support Level |
|----------|-----------------|-------------------|
| **Managed (Expo Go)** | Quick prototyping, crypto-only | Phase 1 Only |
| **Bare (Ejected)** | Production apps, full SIP | Phase 1 + 2 |

**Recommendation:** Start with managed for Phase 1, require bare for Phase 2.

---

### 7.3 Alternative: Flutter SDK

**Consideration:** If React Native proves too complex, consider Flutter

**Flutter Advantages:**
- Mopro has official Flutter support
- Faster build times than React Native
- Rich ecosystem for mobile functionalities
- No JS engine limitations (Dart VM)

**Flutter Disadvantages:**
- Different language (Dart vs TypeScript)
- Smaller Web3 ecosystem compared to React Native
- Team learning curve

**Verdict:** Start with React Native (larger Web3 ecosystem), keep Flutter as backup plan.

---

## 8. Comparative Analysis: Other ZK Protocols

**Research:** How do other ZK protocols handle mobile?

| Protocol | Mobile Support | Approach | Notes |
|----------|---------------|----------|-------|
| **Zcash** | Official mobile SDKs | Native (Swift, Kotlin) | Separate repos for iOS/Android |
| **Tornado Cash** | No official mobile | Browser-only | Users access via mobile browsers |
| **Aztec** | Research phase | Mopro framework (their own) | SIP can leverage this |
| **Aleo** | Rust + WASM | Native bindings | Similar to Mopro approach |
| **Polygon zkEVM** | Browser-only | No mobile SDK | Too compute-intensive |

**Key Insight:** Most production ZK protocols use native mobile SDKs, not WASM.

---

## 9. FAQ

### Q1: Can I use the core SDK in React Native?
**A:** Partially. @noble libraries work, but Noir WASM circuits will fail. You'll get crypto primitives but no ZK proofs.

### Q2: What if Hermes adds WASM support in the future?
**A:** Great! We can offer WASM as an alternative backend. But native will still be faster (10×).

### Q3: Do I need to eject from Expo managed workflow?
**A:** For Phase 1 (crypto-only), no. For Phase 2 (ZK proofs), yes.

### Q4: What about web support?
**A:** Use `@sip-protocol/sdk` (core) for web. React Native SDK is mobile-only.

### Q5: Can I share code between web and mobile?
**A:** Yes, at the business logic level. Use platform-specific SDK underneath:
```typescript
// shared/logic.ts
import { SIP } from Platform.select({
  web: '@sip-protocol/sdk',
  native: '@sip-protocol/sdk-react-native',
})
```

### Q6: How big will the app binary be?
**A:** Estimate: +5-10MB (Mopro native libs + circuits + SRS)

---

## 10. Conclusion

### Feasibility Verdict: ✅ FEASIBLE (High Complexity)

**TL;DR:**
1. **@noble libraries**: Work perfectly in React Native (just need polyfill)
2. **Noir WASM**: Does NOT work in Hermes (need native modules)
3. **Solution**: Use Mopro framework for native ZK proof generation
4. **Effort**: 5-7 weeks for full implementation
5. **Recommendation**: Two-phase rollout (crypto-only → full SDK)

---

### Next Steps

**If approved:**
1. Create `packages/sdk-react-native` directory
2. Set up React Native library boilerplate
3. Implement Phase 1 (crypto-only SDK)
4. Test with example React Native app
5. Begin Mopro integration research (iOS first)
6. Build proof-of-concept with funding proof
7. Expand to full Phase 2 implementation

**Decision Required:**
- Proceed with Phase 1 only (crypto SDK)?
- Commit to Phase 2 (native proofs)?
- Consider Flutter as alternative?

---

## 11. References

### Cryptographic Libraries
- [@noble/curves npm](https://www.npmjs.com/package/@noble/curves)
- [@noble/hashes npm](https://www.npmjs.com/package/@noble/hashes)
- [@noble/ciphers npm](https://www.npmjs.com/package/@noble/ciphers)
- [GitHub - paulmillr/noble-curves](https://github.com/paulmillr/noble-curves)
- [GitHub - paulmillr/noble-hashes](https://github.com/paulmillr/noble-hashes)
- [GitHub - paulmillr/noble-ciphers](https://github.com/paulmillr/noble-ciphers)

### React Native & WASM
- [Using Hermes - React Native](https://reactnative.dev/docs/hermes)
- [WASM support within Hermes? - Issue #429](https://github.com/facebook/hermes/issues/429)
- [GitHub - inokawa/react-native-wasm](https://github.com/inokawa/react-native-wasm)

### Crypto Polyfills
- [react-native-get-random-values npm](https://www.npmjs.com/package/react-native-get-random-values)
- [react-native-quick-crypto GitHub](https://github.com/margelo/react-native-quick-crypto)
- [Callstack Blog - Native Crypto Libraries](https://www.callstack.com/blog/increase-speed-and-security-with-native-crypto-libraries)

### ZK Proofs on Mobile
- [Mopro Documentation](https://zkmopro.org/docs/intro/)
- [Mopro x Noir Integration](https://zkmopro.org/blog/noir-integraion/)
- [Mopro Performance Benchmarks](https://zkmopro.org/docs/performance/)
- [noir-react-native-starter](https://github.com/madztheo/noir-react-native-starter)

### Secure Storage
- [Expo SecureStore Documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo Crypto Documentation](https://docs.expo.dev/versions/latest/sdk/crypto/)
- [LogRocket - Expo SecureStore Tutorial](https://blog.logrocket.com/encrypted-local-storage-in-react-native/)

### Expo
- [Using Hermes Engine - Expo](https://docs.expo.dev/guides/using-hermes/)
- [Store data - Expo Documentation](https://docs.expo.dev/develop/user-interface/store-data/)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-03
**Author:** CIPHER (AI Research Assistant)
**Reviewed By:** Pending
