# @sip-protocol/sdk

## 0.2.0

### Minor Changes

- [`2410b6e`](https://github.com/sip-protocol/sip-protocol/commit/2410b6e2f36a9aabcd294d32238b8995989dc948) Thanks [@rz1989s](https://github.com/rz1989s)! - Add browser WASM support for ZK proof generation
  - New `BrowserNoirProvider` class for browser-based proof generation using WASM
  - Progress callbacks for UI feedback during proof generation
  - Browser support detection (`checkBrowserSupport()`)
  - New import path: `@sip-protocol/sdk/browser`
  - Browser-compatible hex/bytes utilities without Node.js Buffer dependency
