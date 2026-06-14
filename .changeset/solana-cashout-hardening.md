---
"@sip-protocol/sdk": minor
---

Harden Solana gasless cash-out (closes #1141, #1142).

**Jito relayer (#1141):** the Jito bundle path now binds the prepended tip transaction and the confirmation window to the cash-out transaction's own blockhash. Previously a freshly fetched blockhash was used for the tip and for confirmation while the cash-out transaction kept its own, so an expired cash-out blockhash could never land in the atomic bundle and confirmation was judged against the wrong window. `directSubmit` now confirms against the sent transaction's own blockhash. A tip-less `relayTransaction` call now fails loudly (and falls back to direct submission) instead of reporting a never-included bundle as `submitted`.

**Token-2022 (#1142):** `buildGaslessCashout`, `claimStealthPayment`, and `getStealthBalance` accept an optional `tokenProgramId` (defaults to the classic SPL Token program), so Token-2022 mints derive the correct associated-token account and target the correct token program. Existing classic-mint callers are unaffected.

**Cleanup (#1142):** `signEd25519WithScalar` accepts an optional precomputed public key to skip a redundant scalar multiplication per signature; the duplicated Solana `detectCluster` helper is consolidated into one constants module; the independent RPC reads in `buildGaslessCashout` now run concurrently; and the direct `bs58` dependency is dropped in favour of the in-repo base58 encoder.
