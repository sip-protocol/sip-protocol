---
"@sip-protocol/sdk": minor
---

Add a typed privacy-tier fee model. A new `PrivacyTier` enum and frozen fee schedule express the protocol fee in basis points (10 / 30 / 50 bps), gated on which privacy guarantee has shipped — not on volume or time. Includes `getPrivacyTierFee`, `getPrivacyTierFeeBps`, `getCurrentPrivacyTierFee`, `getPrivacyTierSchedule`, and a `computePrivacyTierFee(amount, tier)` helper (basis-point floor division, no flat floor). Exported from the package root (`@sip-protocol/sdk`).
