# @sip-protocol/sdk

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

  **Back-compat:** legacy `SIP:1` (pre-flip) funds remain claimable via the preserved `deriveStealthPrivateKeyV1`, `deriveEd25519StealthPrivateKeyV1`, `deriveSecp256k1StealthPrivateKeyV1`, `checkEd25519StealthAddressV1`, and `checkSecp256k1StealthAddressV1`. `claimStealthPayment` accepts a `version` (`'1' | '2'`) to route derivation.

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
