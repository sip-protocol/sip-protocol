# Thread 10: Cross-Chain vs Same-Chain Privacy

**Hook:** You can have privacy on one chain. But what happens when you bridge?

---

**1/**
You can have privacy on one chain.

But what happens when you bridge?

Cross-chain privacy is hard. Here's why, and how SIP approaches it 🧵

**2/**
Same-chain privacy is "solved":

- Stealth addresses: ✓
- Hidden amounts: ✓
- Instant settlement: ✓

Send SOL to SOL privately? Easy.

**3/**
Cross-chain adds complexity:

SOL → ETH means:
1. Lock SOL somewhere
2. Bridge message
3. Mint/release ETH

Each step can leak information.

**4/**
The bridge problem:

Most bridges:
- Public deposit address
- Public withdraw address
- Timing correlation between chains

Your "private" transfer is linked across chains.

**5/**
Example leak:

10 SOL deposited to Wormhole at 3:14pm
10 ETH (equivalent) received at 3:17pm

Even with stealth addresses on each chain, the bridge links them.

**6/**
Three approaches to cross-chain privacy:

1. **Privacy chains**: Settle through Zcash/Secret
2. **Intent-based**: Hide details from bridges
3. **Proof composition**: Cryptographic linking

**7/**
Approach 1: Privacy chains

Route through Zcash:
SOL → [bridge] → ZEC (shielded) → [bridge] → ETH

Pro: Strong privacy in the middle
Con: Complex, slow, liquidity limited

**8/**
Approach 2: Intent-based

User submits intent: "10 SOL → ETH, private"

Solver network fulfills:
- User gets ETH to stealth address
- Solver gets SOL
- No bridge linking user's addresses

**9/**
SIP uses intent-based (via NEAR Intents):

```typescript
const intent = await sip.createIntent({
  input: { chain: 'solana', token: 'SOL', amount: 10n },
  output: { chain: 'ethereum', token: 'ETH' },
  privacy: PrivacyLevel.SHIELDED,
})
```

**10/**
How intents hide the connection:

User: Sends SOL to solver address
Solver: Sends ETH to user's stealth address

On-chain: Two unrelated transactions
Reality: Atomic swap, no bridge link

**11/**
Approach 3: Proof composition (future)

Combine proofs from multiple chains:
- Zcash proof + Mina proof = cross-chain proof

Most complex, but most powerful.
SIP is researching this for M19-M20.

**12/**
Current SIP capability:

✅ Same-chain: Solana fully supported
✅ Cross-chain (intents): Via NEAR Intents network
🔜 Cross-chain (native): Ethereum same-chain (M18)
🔜 Proof composition: Research phase (M19)

**13/**
Which should you use?

Need: Privacy on Solana?
→ Same-chain, use SIP SDK directly

Need: SOL → ETH privately?
→ Cross-chain intents (available now)

Need: Multi-hop complex routes?
→ Wait for proof composition (2026)

**14/**
Same-chain is shipping now.

Cross-chain intents are live.

Proof composition is the future.

docs.sip-protocol.org/cross-chain

---

**Engagement CTA:** "What cross-chain privacy route do you need most? SOL↔ETH? SOL↔BTC?"

**Hashtags:** #CrossChain #DeFi #Privacy
