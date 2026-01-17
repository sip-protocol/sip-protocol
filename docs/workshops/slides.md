# SIP Protocol Workshop Slides

**Building Privacy-Enabled dApps with SIP**

---

## Slide 1: Welcome

**Building Privacy-Enabled dApps**
*with SIP Protocol*

Today's agenda:
1. Why blockchain privacy matters
2. How SIP works (no PhD required)
3. Hands-on: Add privacy to your dApp
4. Q&A

---

## Slide 2: The Privacy Problem

**Everything is public on-chain**

When you send 100 SOL:
- Your address: visible
- Recipient address: visible
- Amount: visible
- Every past transaction: visible
- Every future transaction: visible

*Your on-chain activity is your public diary.*

---

## Slide 3: Real-World Consequences

**Why should developers care?**

- **Front-running**: MEV bots see your swap, front-run it
- **Doxxing**: Wallet linked to identity = security risk
- **Business intelligence**: Competitors see your treasury
- **Targeted attacks**: Whales become phishing targets

*83% of institutional investors cite privacy as a barrier to crypto adoption.*

---

## Slide 4: Current Solutions

**Existing approaches and their limits**

| Solution | Problem |
|----------|---------|
| Mixers (Tornado Cash) | Sanctioned, fixed amounts |
| New L1s (Secret, Oasis) | Fragmented liquidity |
| ZK rollups | Limited to specific chains |

*We need privacy on the chains people actually use.*

---

## Slide 5: Enter SIP Protocol

**Privacy as middleware, not infrastructure**

```
Your dApp → [SIP Privacy Layer] → Solana/Ethereum/NEAR
                    ↓
            - Hidden sender
            - Hidden amount
            - Hidden recipient
```

One toggle to add privacy. Works on existing chains.

---

## Slide 6: How It Works (Simple Version)

**Three cryptographic primitives**

1. **Stealth Addresses**: One-time recipient addresses
   - Share meta-address, receive to unique addresses
   - Breaks link between payments

2. **Pedersen Commitments**: Hidden amounts
   - `commit(amount) = amount × G + random × H`
   - Verifiable without revealing value

3. **Viewing Keys**: Selective disclosure
   - Privacy by default
   - Reveal to auditors when needed

---

## Slide 7: Stealth Addresses Explained

**How recipients stay private**

```
Recipient shares: sip:solana:0x02abc...

Sender generates one-time address:
  → Ephemeral key + recipient's key = unique address

On-chain: Payment to 0x7f3d... (random-looking)
Reality: Only recipient can spend
```

*Each payment = new address = no linkability*

---

## Slide 8: Viewing Keys Explained

**Compliance without compromising privacy**

```
Transaction is encrypted on-chain

Viewing key holders can decrypt:
- Auditors (with time-limited keys)
- The recipient
- No one else

Privacy + Compliance ✓
```

*Like giving your accountant read access to your books.*

---

## Slide 9: Privacy Levels

**Three modes for different needs**

| Level | Use Case | Example |
|-------|----------|---------|
| `transparent` | Public payments | Charity donations |
| `shielded` | Full privacy | Personal transfers |
| `compliant` | Privacy + audit | Business payments |

*Developer chooses, user benefits.*

---

## Slide 10: The SDK

**One npm package**

```bash
npm install @sip-protocol/sdk
```

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk'

const sip = new SIP({ network: 'mainnet' })
const payment = await sip.createPayment({
  amount: 100n * 10n**6n,
  token: 'USDC',
  recipient: recipientMeta,
  privacy: PrivacyLevel.SHIELDED,
})
```

*3 lines to add privacy.*

---

## Slide 11: What We're Building Today

**Hands-on: Private Payment Button**

You'll build:
1. Generate stealth meta-address for user
2. Send private payment to another user
3. Scan and claim incoming payments

Starting point: Simple wallet UI
End result: Privacy-enabled wallet

---

## Slide 12: Let's Code!

**Workshop time**

1. Clone the starter repo
2. Follow hands-on-tutorial.md
3. Ask questions anytime

```bash
git clone https://github.com/sip-protocol/workshop-starter
cd workshop-starter
npm install
```

*Tutorial: docs/workshops/hands-on-tutorial.md*

---

## Slide 13: Key Takeaways

**Remember these**

1. **Privacy is a feature, not a chain**
   - Add to existing dApps, no migration needed

2. **Three primitives**
   - Stealth addresses, commitments, viewing keys

3. **Compliance-ready**
   - Viewing keys = privacy + audit capability

4. **Simple integration**
   - One SDK, works across chains

---

## Slide 14: Resources

**Keep learning**

- Docs: https://docs.sip-protocol.org
- SDK: `npm install @sip-protocol/sdk`
- GitHub: https://github.com/sip-protocol
- Discord: https://discord.gg/sip-protocol

**Quick-start guides:**
- Wallet integration
- DEX privacy
- DAO treasury
- NFT marketplaces
- Payment apps

---

## Slide 15: Q&A

**Questions?**

Common questions covered in faq.md

*Let's discuss!*

---

## Presenter Notes

### Timing Guide
- Slides 1-9: 15 minutes (privacy intro)
- Slides 10-11: 5 minutes (SDK overview)
- Slide 12: Transition to hands-on
- Slides 13-15: 10 minutes (wrap-up, Q&A)

### Key Points to Emphasize
1. Privacy is about user protection, not hiding illegal activity
2. SIP is middleware - works with existing chains
3. Viewing keys solve the compliance concern
4. Simple API - developers don't need crypto PhD

### Demo Tips
- Have a pre-configured demo ready as backup
- Test Helius connection before workshop
- Show real devnet transactions if possible

---

*Slide content optimized for 16:9 presentation format*
