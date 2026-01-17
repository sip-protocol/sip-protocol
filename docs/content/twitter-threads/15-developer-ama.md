# Thread 15: Developer AMA Recap

**Hook:** We did a developer AMA. Here are the most asked questions and answers.

---

**1/**
We did a developer AMA with 50+ builders.

Here are the most asked questions and our answers 🧵

**2/**
**Q: Is SIP production ready?**

A: For same-chain Solana privacy, yes.

3000+ tests, used in several projects.

Cross-chain is still in development. Use testnet first for new integrations.

**3/**
**Q: How does this compare to Aztec/Zcash?**

A: Different goals.

Aztec: Private L2 (you move to their chain)
Zcash: Privacy chain (shielded pool)
SIP: Privacy middleware (works on existing chains)

We're complementary, not competing.

**4/**
**Q: What about MEV protection?**

A: Hidden amounts help, but not full MEV protection.

Stealth addresses: ✓ Hide recipient
Commitments: ✓ Hide amount
Timing: ✗ Still visible when you submit

For full MEV protection, combine with Jito bundles.

**5/**
**Q: Can viewing keys be revoked?**

A: Derived keys can be time-limited, but you can't "un-see" transactions.

Best practice:
- Use time-limited keys for external auditors
- Rotate derived keys quarterly
- Track key usage in audit logs

**6/**
**Q: How do gas fees work with stealth addresses?**

A: Recipient pays to claim.

Stealth address receives funds → has balance
Recipient derives key → can sign
Recipient sends claim tx → pays normal fee

No fee relay (yet) — on roadmap.

**7/**
**Q: What if I lose my viewing key?**

A: Spending key ≠ viewing key.

Lost viewing key: Can't scan for payments (but funds safe)
Lost spending key: Funds lost

Backup both. Preferably in different locations.

**8/**
**Q: Is the code audited?**

A: Formal audit in progress (Hacken, Q1 2026).

Currently:
- 3000+ tests
- Internal security review
- Uses audited crypto libraries (@noble/*)

Don't put life savings until audit complete.

**9/**
**Q: How fast is scanning?**

A: Depends on provider:

Helius (indexed): ~1-3s for 1000 txs
Generic RPC: Slower (needs to fetch more)
Webhook: Real-time (push, not poll)

For production, use webhook integration.

**10/**
**Q: React Native support?**

A: Yes, but early.

```bash
npm install @sip-protocol/react-native
```

Works with Expo. Some crypto functions need native modules.
Test thoroughly on your target devices.

**11/**
**Q: What chains are planned?**

A: Roadmap:

Now: Solana (same-chain)
Q1 2026: Ethereum (same-chain)
Q2 2026: Cross-chain (via NEAR Intents)
Q3 2026: More EVM chains (Base, Arbitrum)

**12/**
**Q: How do I contribute?**

A: Many ways:

- Code: PRs welcome (check good-first-issue)
- Docs: Improve guides and examples
- Testing: Report bugs on GitHub
- Ideas: Feature requests via issues

Start: github.com/sip-protocol

**13/**
**Q: Is there a token?**

A: Not yet.

Focused on building useful infrastructure first.

If/when token: Probably for protocol fees, not speculation.

Don't buy anything claiming to be SIP token — it's a scam.

**14/**
More questions?

Join Discord for live Q&A: discord.gg/sip-protocol

Next AMA: Follow @sipprotocol for announcements.

Thanks to everyone who participated!

---

**Engagement CTA:** "What question do you have that wasn't covered? Drop it below 👇"

**Hashtags:** #AMA #DevRel #Web3Dev
