---
'@sip-protocol/sdk': patch
---

Add view-only EVM stealth scanning (#1104). `checkEthereumStealthByEthAddressViewOnly` and `EthereumPrivacyAdapter.scanAnnouncementsViewOnly` detect incoming payments using the viewing private key + spending public key only — never the spending private key — restoring the compliance/delegation property on EVM (previously the only scan path, `scanAnnouncements`, required the spending private key). `EthereumScanRecipient.spendingPrivateKey` is now optional so a view-only recipient can register with just `viewingPrivateKey` + `spendingPublicKey`; the full `scanAnnouncements` (which derives claimable keys) skips recipients that lack it.
