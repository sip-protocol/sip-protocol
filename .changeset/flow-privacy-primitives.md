---
"@sip-protocol/sdk": minor
---

Add per-flow privacy-score primitives (`flow-privacy` module): `anonSetInWindow`, `gaslessFlag`, `amountHidingStatus`, and the `assessFlowPrivacy` composer. They honestly score a single commingling-vault flow — a tier-capped 0–100 score plus an anonymity-set / gasless / amount-hiding factor breakdown with caveats — over caller-supplied data (no RPC).
