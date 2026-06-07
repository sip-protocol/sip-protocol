---
'@sip-protocol/sdk': patch
---

Canonical EIP-5564 stealth follow-ups (#1099):

- secp256k1 `generateSecp256k1StealthAddress` / `checkSecp256k1StealthAddress` now reduce `hash(S) mod n` and guard the zero scalar before computing `hash(S)·G`, mirroring the ed25519 path and keeping generate/derive/check symmetric (#1102). Behavior is unchanged for all reachable inputs.
- NEAR announcements are now emitted with the canonical `SIP:2` prefix; `parseAnnouncement` accepts both `SIP:1` and `SIP:2` and reports the detected version, and the resolver scans both (#1103). Legacy `SIP:1` announcements remain parseable.
- Fixed a stale `SIP:1` comment in the Solana send path and documented claiming legacy `SIP:1` payments via `claimStealthPayment({ version: '1' })` (#1105).
