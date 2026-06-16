# @sip-protocol/sdk

## 0.13.0

### Minor Changes

- [#1144](https://github.com/sip-protocol/sip-protocol/pull/1144) [`08f7e13`](https://github.com/sip-protocol/sip-protocol/commit/08f7e132288dce9562212b050a964add28079d06) Thanks [@rz1989s](https://github.com/rz1989s)! - Harden Solana gasless cash-out (closes [#1141](https://github.com/sip-protocol/sip-protocol/issues/1141), [#1142](https://github.com/sip-protocol/sip-protocol/issues/1142)).

  **Jito relayer ([#1141](https://github.com/sip-protocol/sip-protocol/issues/1141)):** the Jito bundle path now binds the prepended tip transaction and the confirmation window to the cash-out transaction's own blockhash. Previously a freshly fetched blockhash was used for the tip and for confirmation while the cash-out transaction kept its own, so an expired cash-out blockhash could never land in the atomic bundle and confirmation was judged against the wrong window. `directSubmit` now confirms against the sent transaction's own blockhash. A tip-less `relayTransaction` call now fails loudly (and falls back to direct submission) instead of reporting a never-included bundle as `submitted`.

  **Token-2022 ([#1142](https://github.com/sip-protocol/sip-protocol/issues/1142)):** `buildGaslessCashout`, `claimStealthPayment`, and `getStealthBalance` accept an optional `tokenProgramId` (defaults to the classic SPL Token program), so Token-2022 mints derive the correct associated-token account and target the correct token program. Existing classic-mint callers are unaffected.

  **Cleanup ([#1142](https://github.com/sip-protocol/sip-protocol/issues/1142)):** `signEd25519WithScalar` accepts an optional precomputed public key to skip a redundant scalar multiplication per signature; the duplicated Solana `detectCluster` helper is consolidated into one constants module; the independent RPC reads in `buildGaslessCashout` now run concurrently; and the direct `bs58` dependency is dropped in favour of the in-repo base58 encoder.

## 0.12.0

### Minor Changes

- [#1140](https://github.com/sip-protocol/sip-protocol/pull/1140) [`46f9607`](https://github.com/sip-protocol/sip-protocol/commit/46f960790b3bf0c1d4fd06e02ccdcf1f75f9aeba) Thanks [@rz1989s](https://github.com/rz1989s)! - Add gasless cash-out relayer for stealth recipients
  - `buildGaslessCashout` / `submitGaslessCashout`: build and submit a stealth-claim transaction where a relayer pays the network fee and recovers it from the claimed amount (direct fee-payer submission, with an optional Jito bundle path for mainnet hardening).
  - `computeRelayerFee`: hybrid relayer-fee helper — `max(flatFloor, amount * bps / 10_000)` — with input validation.
  - `deriveStealthSigner` / `signEd25519WithScalar`: correct ed25519 signing for scalar-derived stealth addresses. Claiming an ed25519 stealth payment via the SDK previously produced invalid signatures because the derived scalar was signed as a key seed; stealth claims now sign and verify correctly.
  - `SolanaScanResult` (and `DetectedPayment`) now carry the announcement scheme `version`, so a scanned payment claims with the matching derivation — legacy `SIP:1` payments stay claimable.

## 0.11.1

### Patch Changes

- [#1124](https://github.com/sip-protocol/sip-protocol/pull/1124) [`215093b`](https://github.com/sip-protocol/sip-protocol/commit/215093bd7a348a1b163a694e1801fe227fd5eb53) Thanks [@rz1989s](https://github.com/rz1989s)! - Export `SIP_MEMO_PREFIX_V2` (`'SIP:2:'`) and `SIP_MEMO_PREFIX_ANY` (`'SIP:'`) from the package entry. Both constants were defined in `chains/solana/constants.ts` and re-exported from the `chains/solana` sub-barrel, but were missing from the public `src/index.ts`, so ESM/TypeScript consumers could not import them by name (they resolved to `undefined` under bundlers that tolerate missing named ESM imports, and errored under `tsc`). Closes [#1123](https://github.com/sip-protocol/sip-protocol/issues/1123).

## 0.11.0

### Minor Changes

- [#1107](https://github.com/sip-protocol/sip-protocol/pull/1107) [`231a815`](https://github.com/sip-protocol/sip-protocol/commit/231a8150a341473b284e5b1a17b1bcc1d456bedb) Thanks [@rz1989s](https://github.com/rz1989s)! - Add view-only EVM stealth scanning ([#1104](https://github.com/sip-protocol/sip-protocol/issues/1104)). `checkEthereumStealthByEthAddressViewOnly` and `EthereumPrivacyAdapter.scanAnnouncementsViewOnly` detect incoming payments using the viewing private key + spending public key only — never the spending private key — restoring the compliance/delegation property on EVM (previously the only scan path, `scanAnnouncements`, required the spending private key). `EthereumScanRecipient.spendingPrivateKey` is now optional so a view-only recipient can register with just `viewingPrivateKey` + `spendingPublicKey`; the full `scanAnnouncements` (which derives claimable keys) skips recipients that lack it.

### Patch Changes

- [#1106](https://github.com/sip-protocol/sip-protocol/pull/1106) [`6b063f9`](https://github.com/sip-protocol/sip-protocol/commit/6b063f930c3c21480a05073536ea56b0b92c10a1) Thanks [@rz1989s](https://github.com/rz1989s)! - Canonical EIP-5564 stealth follow-ups ([#1099](https://github.com/sip-protocol/sip-protocol/issues/1099)):
  - secp256k1 `generateSecp256k1StealthAddress` / `checkSecp256k1StealthAddress` now reduce `hash(S) mod n` and guard the zero scalar before computing `hash(S)·G`, mirroring the ed25519 path and keeping generate/derive/check symmetric ([#1102](https://github.com/sip-protocol/sip-protocol/issues/1102)). Behavior is unchanged for all reachable inputs.
  - NEAR announcements are now emitted with the canonical `SIP:2` prefix; `parseAnnouncement` accepts both `SIP:1` and `SIP:2` and reports the detected version, and the resolver scans both ([#1103](https://github.com/sip-protocol/sip-protocol/issues/1103)). Legacy `SIP:1` announcements remain parseable.
  - Fixed a stale `SIP:1` comment in the Solana send path and documented claiming legacy `SIP:1` payments via `claimStealthPayment({ version: '1' })` ([#1105](https://github.com/sip-protocol/sip-protocol/issues/1105)).

## 0.10.0

### Minor Changes

- **BREAKING (security):** Canonical EIP-5564 stealth scheme — fixes view-only scanning ([#1099](https://github.com/sip-protocol/sip-protocol/issues/1099))

  The secp256k1 and ed25519 stealth implementations previously swapped the two EIP-5564 key roles (ECDH on the spending key; one-time address built on the viewing key), which made view-only scanning cryptographically impossible — every "scan with the viewing key" surface silently failed. Both curves are now canonical: the ECDH shared secret is computed from the **viewing** key (`S = r·K_view`) and the one-time address/key is built on the **spending** key (`A = K_spend + H(S)·G`). View-only delegation now works as advertised.

  **Breaking API change** — every `check*StealthAddress` is now **view-only** and takes `(stealthAddress, viewingPrivateKey, spendingPublicKey)` (previously `(stealthAddress, spendingPrivateKey, viewingPrivateKey)`):
  - `checkStealthAddress`, `checkEd25519StealthAddress`, `checkSecp256k1StealthAddress`
  - `checkNEARStealthAddress`, `checkEthereumStealthAddress`, `checkSuiStealthAddress`, `checkAptosStealthAddress`
  - `EthereumPrivacyAdapter.checkStealthAddress`, `NEARPrivacyAdapter.checkStealthAddress`, `SuiStealthService.checkStealthAddress`, `AptosStealthService.checkStealthAddress`

  `deriveStealthPrivateKey` / `derive*StealthPrivateKey` signatures are **unchanged** (recovering a spendable key still requires both private keys).

  **Now correct with no call-site change:** `scanForPayments`, `StealthScanner`, the webhook provider, and `@sip-protocol/react` `useScanPayments` already passed `(viewingPrivateKey, spendingPublicKey)`.

  **Solana announcements** are now emitted with the `SIP:2:` prefix; `SIP:1:` announcements remain parseable (`parseAnnouncement` returns a `version`).

  **Back-compat:** legacy `SIP:1` (pre-flip) funds remain claimable via the preserved `deriveStealthPrivateKeyV1`, `deriveEd25519StealthPrivateKeyV1`, `deriveSecp256k1StealthPrivateKeyV1`, `checkEd25519StealthAddressV1`, and `checkSecp256k1StealthAddressV1`. `claimStealthPayment` accepts a `version` (`'1' | '2'`) to route derivation — it defaults to `'2'` (canonical), so pass `version: '1'` to claim a pre-flip payment:

  ```typescript
  await claimStealthPayment({
    connection,
    stealthAddress,
    ephemeralPublicKey,
    viewingPrivateKey,
    spendingPrivateKey,
    destinationAddress,
    mint,
    version: '1', // claim a legacy SIP:1 (pre-flip) payment; omit for canonical SIP:2
  })
  ```

### Removed

- Removed the unused Solana ephemeral stealth helpers `computeStealthAddress`, `ManagedEphemeralKeypair.useForStealthAddress`, `formatEphemeralAnnouncement`, `parseEphemeralAnnouncement`, and the `EphemeralKeyUsageResult` type. They were non-canonical (little-endian hash tweak + `SIP:1` announcement tag) and produced stealth addresses that are undetectable and unspendable under the canonical EIP-5564 scheme. Use `generateStealthAddress`, `createAnnouncementMemo`, and `scanForPayments` instead. The safe ephemeral key-generation/disposal utilities (`generateEphemeralKeypair`, `generateManagedEphemeralKeypair`, `batchGenerate*`, `disposeEphemeralKeypairs`, `wipeEphemeralPrivateKey`) remain.

## 0.9.0

### Minor Changes

- feat: Ethereum same-chain privacy with shielded transfers via Solidity contracts
  - Fix `scanAnnouncements()` scanning with correct spending private key
  - Add `checkEthereumStealthByEthAddress()` for ETH address-based stealth matching
  - Add Base Sepolia and OP Sepolia contract addresses
  - Add `spendingPrivateKey` to `EthereumScanRecipient` type

### Patch Changes

- fix: DAI mainnet address invalid hex characters
- fix: Remove deprecated `checkViewTag()` stub
- chore: Update `@sip-protocol/types` dependency to `^0.2.2`

## 0.8.0

### Minor Changes

- feat: Solana same-chain privacy with shielded transfers via Anchor program
  - `shieldedTransfer` API for native SOL privacy transfers
  - CSPLTokenService and CSPLClient exported from main entry
  - Migrated Solana RPC client to `@solana/kit`
- feat: Sunspot ZK verifier pipeline for Noir proof verification on Solana
- feat: Network privacy layer (Tor/SOCKS5 proxy support) for Solana RPC calls
- feat: Winternitz vault integration for quantum-resistant key storage
- feat: Browser-compatible proof composition (Halo2 + Kimchi exports)
- feat: BNB Chain (BSC) support for multi-chain stealth addresses
- feat: Oblivious Sync Service interface for private state synchronization
- feat: NEAR fee contract integration for protocol revenue
- feat: Chain-specific optimizations for Solana, EVM, and BNB

### Patch Changes

- fix: Use workspace protocol for types dependency
- fix: Relax NEAR benchmark thresholds for CI runners
- chore: Bump ephemeral-rollups-sdk to 0.8.5

## 0.7.4

### Patch Changes

- chore: Version bump with types dependency alignment

## 0.2.2

### Patch Changes

- fix: Remove NoirProofProvider from main entry to fully fix WASM bundling in SSR
  - NoirProofProvider now available via `@sip-protocol/sdk/proofs/noir`
  - BrowserNoirProvider available via `@sip-protocol/sdk/browser`
  - Main entry (`@sip-protocol/sdk`) has no WASM dependencies
  - MockProofProvider still available from main entry (no WASM)

## 0.2.1

### Patch Changes

- fix: Remove BrowserNoirProvider from main entry to fix WASM bundling in SSR
  - BrowserNoirProvider is now only available via `@sip-protocol/sdk/browser`
  - Prevents WASM from being bundled in server-side builds (e.g., Next.js SSR)
  - Browser utilities (isBrowser, etc.) remain available from main entry

## 0.2.0

### Minor Changes

- [`2410b6e`](https://github.com/sip-protocol/sip-protocol/commit/2410b6e2f36a9aabcd294d32238b8995989dc948) Thanks [@rz1989s](https://github.com/rz1989s)! - Add browser WASM support for ZK proof generation
  - New `BrowserNoirProvider` class for browser-based proof generation using WASM
  - Progress callbacks for UI feedback during proof generation
  - Browser support detection (`checkBrowserSupport()`)
  - New import path: `@sip-protocol/sdk/browser`
  - Browser-compatible hex/bytes utilities without Node.js Buffer dependency
