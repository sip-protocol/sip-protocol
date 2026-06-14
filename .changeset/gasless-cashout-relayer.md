---
"@sip-protocol/sdk": minor
---

Add gasless cash-out relayer for stealth recipients

- `buildGaslessCashout` / `submitGaslessCashout`: build and submit a stealth-claim transaction where a relayer pays the network fee and recovers it from the claimed amount (direct fee-payer submission, with an optional Jito bundle path for mainnet hardening).
- `computeRelayerFee`: hybrid relayer-fee helper — `max(flatFloor, amount * bps / 10_000)` — with input validation.
- `deriveStealthSigner` / `signEd25519WithScalar`: correct ed25519 signing for scalar-derived stealth addresses. Claiming an ed25519 stealth payment via the SDK previously produced invalid signatures because the derived scalar was signed as a key seed; stealth claims now sign and verify correctly.
- `SolanaScanResult` (and `DetectedPayment`) now carry the announcement scheme `version`, so a scanned payment claims with the matching derivation — legacy `SIP:1` payments stay claimable.
