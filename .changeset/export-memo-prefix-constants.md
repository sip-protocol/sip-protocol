---
"@sip-protocol/sdk": patch
---

Export `SIP_MEMO_PREFIX_V2` (`'SIP:2:'`) and `SIP_MEMO_PREFIX_ANY` (`'SIP:'`) from the package entry. Both constants were defined in `chains/solana/constants.ts` and re-exported from the `chains/solana` sub-barrel, but were missing from the public `src/index.ts`, so ESM/TypeScript consumers could not import them by name (they resolved to `undefined` under bundlers that tolerate missing named ESM imports, and errored under `tsc`). Closes #1123.
