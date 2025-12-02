# @sip-protocol/sdk

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
