# Thread 3: Pedersen Commitments Explained

**Hook:** How do you prove you have enough money without showing how much? Pedersen commitments.

---

**1/**
How do you prove you have enough money without showing how much?

This is the core problem of financial privacy.

Pedersen commitments solve it. No math PhD required 🧵

**2/**
The problem:

On blockchain, amounts are public.

Send 1000 USDC → everyone sees 1000 USDC

This reveals:
- Your wealth
- Your spending patterns
- Business intelligence

**3/**
What if you could hide the amount but still prove:

✓ You have enough to send
✓ Input = output (no printing money)
✓ Amount is positive (no debt tricks)

That's what Pedersen commitments enable.

**4/**
Simplest analogy: A sealed envelope.

You put a number in an envelope.

Others can't see the number.

But you can prove things about it without opening.

**5/**
How Pedersen commitments work:

commitment = amount × G + random × H

Where:
- G, H are fixed curve points (like constants)
- random is your secret "blinding factor"
- Result: a point that hides the amount

**6/**
Why can't someone figure out the amount?

Because there are infinite combinations of (amount, random) that give the same commitment.

Without knowing your random value, the amount is hidden.

**7/**
But here's the magic: You can still prove things!

If I commit to 100 and you commit to 100:
my_commitment + your_commitment = commitment to 200

Without either of us revealing our amounts.

**8/**
This enables:

"I have at least 1000" → Range proof
"My input = your output" → Balance proof
"Total deposits = total withdrawals" → Conservation proof

All without revealing exact amounts.

**9/**
Real example:

Alice commits to 500 USDC
Bob commits to 500 USDC
They combine commitments

On-chain: random point
Reality: 1000 USDC
Verifiable: inputs = outputs

**10/**
Why "Pedersen"?

Named after Torben Pedersen who published this in 1991.

30+ years later, still the gold standard for hiding values on blockchains.

Used in: Monero, Zcash, Grin, SIP Protocol

**11/**
SIP uses Pedersen commitments for:

→ Hidden swap amounts
→ Hidden payment values
→ Hidden treasury balances
→ All verifiable without revealing

**12/**
Code example:

```typescript
import { commit, generateBlinding } from '@sip-protocol/sdk'

const amount = 1000n
const blinding = generateBlinding()
const commitment = commit(amount, blinding)

// commitment.value = hidden amount
// Keep blinding secret!
```

**13/**
The beautiful part:

Blockchain sees: random curve point
You see: 1000 USDC
Verifier confirms: math checks out
No one learns: actual amount

Privacy and verifiability. Together.

**14/**
Pedersen commitments are one building block.

Combined with stealth addresses and viewing keys, you get complete transaction privacy.

That's what @sipprotocol is building.

docs.sip-protocol.org

---

**Engagement CTA:** "What would you hide if amounts were private by default?"

**Hashtags:** #Solana #ZKP #Web3Privacy
