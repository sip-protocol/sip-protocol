# Workshop FAQ

Common questions from SIP Protocol developer workshops.

---

## General Privacy Questions

### Q: Isn't privacy just for criminals?

**A:** No. Privacy is a fundamental right that protects legitimate users:

- **Individuals**: Prevent stalking, targeted attacks, identity theft
- **Businesses**: Protect treasury movements, vendor relationships, salaries
- **DAOs**: Hide governance votes, treasury strategy from competitors
- **Institutions**: Meet fiduciary duties, prevent front-running

The same privacy tools that protect criminals also protect journalists, activists, abuse survivors, and everyday users. We believe in building compliant privacy with viewing keys for legitimate audit needs.

---

### Q: How is this different from Tornado Cash?

**A:** Several key differences:

| Feature | Tornado Cash | SIP Protocol |
|---------|--------------|--------------|
| Amounts | Fixed pool sizes (0.1, 1, 10 ETH) | Any amount |
| Compliance | None | Viewing keys for auditors |
| Model | Pool mixing | Cryptographic hiding |
| Chain | Ethereum only | Multi-chain (Solana, ETH, NEAR) |
| Vulnerability | Statistical analysis attacks | Resistant to amount correlation |

SIP uses cryptographic privacy (Pedersen commitments) rather than mixing pools, which provides stronger privacy guarantees and regulatory compliance options.

---

### Q: What about regulatory compliance?

**A:** SIP is designed for compliance:

1. **Viewing Keys**: Generate keys that let auditors see your transactions
2. **Time-Limited Access**: Auditor keys can expire after review period
3. **Selective Disclosure**: Reveal specific transactions, not entire history
4. **Role-Based Access**: Different permissions for different stakeholders

Example: A DAO can give treasury members full visibility, regular members proposal-only access, and external auditors time-limited quarterly access.

---

## Technical Questions

### Q: What chains does SIP support?

**A:** Currently:

- **Solana** (primary focus)
- **Ethereum** (EVM chains)
- **NEAR** (via Intents)
- **Move chains** (Aptos, Sui)
- **Cosmos** (IBC chains)
- **Bitcoin** (Taproot-based)

The SDK is chain-agnostic - same API works across chains.

---

### Q: How do stealth addresses work?

**A:** Simplified explanation:

1. **Recipient publishes**: `metaAddress = (spendingPubKey, viewingPubKey)`
2. **Sender generates**: `ephemeralKey` (random)
3. **Sender computes**: `sharedSecret = ECDH(ephemeralKey, viewingPubKey)`
4. **Sender derives**: `stealthAddress = spendingPubKey + hash(sharedSecret) × G`
5. **Sender includes**: `ephemeralPublicKey` in transaction memo

Only recipient can derive private key:
```
stealthPrivKey = spendingPrivKey + hash(sharedSecret)
```

Result: Each payment goes to a unique address only the recipient can spend.

---

### Q: What are Pedersen commitments?

**A:** A way to hide amounts while keeping them verifiable:

```
commitment = amount × G + blinding × H
```

Where:
- `G, H` are curve generator points
- `blinding` is random number (you keep secret)
- Result: No one can determine `amount` from `commitment`

But you can prove properties:
- "Commitment A + Commitment B = Commitment C" (amounts balance)
- "Commitment > 0" (no negative amounts)
- "Commitment ≤ threshold" (spending limits)

---

### Q: How fast is scanning for payments?

**A:** Depends on configuration:

- **Helius indexed**: ~1-3 seconds for last 1000 transactions
- **Full history scan**: Can take longer for heavy wallets
- **Webhook-based**: Real-time notification when payments arrive

For production apps, we recommend webhook integration for instant notifications.

---

### Q: Can I use my own RPC provider?

**A:** Yes. SIP is infrastructure-agnostic:

```typescript
const provider = createProvider('generic', {
  rpcUrl: 'https://your-rpc.example.com',
})

// Or specific providers
createProvider('helius', { apiKey: '...' })
createProvider('quicknode', { apiKey: '...' })
createProvider('triton', { apiKey: '...' })
```

---

### Q: What happens if I lose my keys?

**A:** Like any crypto:

- **Lost spending key**: Funds are lost forever
- **Lost viewing key**: Can't scan for payments (but funds are safe if you have spending key)
- **Compromised viewing key**: Attacker can see transactions but not spend

Recommendation: Use secure key management (hardware wallet, MPC, encrypted backup).

---

## Integration Questions

### Q: How do I integrate with an existing wallet?

**A:** Minimal changes required:

1. Generate stealth meta-address for user (once)
2. Store spending/viewing keys securely
3. Add "Private Send" option using stealth address generation
4. Add background scanning for incoming payments

See [QUICK-START-WALLET.md](../guides/QUICK-START-WALLET.md) for complete guide.

---

### Q: How much does it cost?

**A:** SIP adds minimal overhead:

- **SDK**: Free, open source
- **Transaction fees**: ~5000 extra lamports for memo (negligible)
- **RPC calls**: Standard rates from your provider
- **Gas for claims**: Normal transfer cost

No protocol fees currently. Future token may include minimal fees.

---

### Q: Can I use React hooks?

**A:** Yes! We have a React package:

```bash
npm install @sip-protocol/react
```

```typescript
import {
  useSIP,
  useStealthAddress,
  usePrivateSwap,
} from '@sip-protocol/react'

function MyComponent() {
  const { generateAddress, scanPayments } = useStealthAddress()
  // ...
}
```

---

### Q: Is there a CLI for testing?

**A:** Yes:

```bash
npm install -g @sip-protocol/cli

# Generate address
sip-cli generate-address

# Send privately
sip-cli send --to sip:solana:0x... --amount 1 --token SOL

# Scan for payments
sip-cli scan --viewing-key 0x...
```

---

## Security Questions

### Q: Has SIP been audited?

**A:** Status:

- **Cryptographic review**: Internal, based on peer-reviewed primitives
- **Code audit**: In progress (Hacken, scheduled Q1 2026)
- **Bug bounty**: Active on Immunefi

We use battle-tested libraries (@noble/curves, @noble/ciphers) for all cryptography.

---

### Q: What if there's a bug in the SDK?

**A:** Risk mitigation:

1. **Extensive testing**: 3000+ tests covering edge cases
2. **Gradual rollout**: Devnet → testnet → mainnet
3. **Viewing key backup**: Even if SDK breaks, funds are recoverable
4. **Open source**: Community can audit and fix

For production, we recommend starting with small amounts and increasing as you gain confidence.

---

### Q: Are viewing keys safe to share?

**A:** Viewing keys have **read-only** access:

- ✓ Can see transaction amounts and recipients
- ✓ Can scan for incoming payments
- ✗ Cannot spend funds
- ✗ Cannot create transactions

Share viewing keys with auditors, not the public. Use time-limited and scoped keys for external parties.

---

## Troubleshooting

### Q: "Transaction simulation failed"

**A:** Common causes:

1. Insufficient SOL for fees
2. Token account doesn't exist (need to create)
3. Wrong network (mainnet vs devnet)
4. RPC rate limiting

Check Explorer for detailed error message.

---

### Q: "No payments found" when scanning

**A:** Verify:

1. Payment was actually sent (check Explorer)
2. Correct viewing key is being used
3. Scan range includes the transaction slot
4. Wait 30+ seconds for indexing

---

### Q: "Invalid stealth address format"

**A:** Stealth meta-addresses must be formatted as:

```
sip:<chain>:<spendingPubKey>:<viewingPubKey>
```

Example:
```
sip:solana:0x02abc123...def:0x03xyz789...ghi
```

Use `encodeStealthMetaAddress()` to generate correct format.

---

## Business Questions

### Q: Is SIP production ready?

**A:** Current status:

- **SDK**: Production-ready for same-chain privacy
- **Cross-chain**: In development
- **Audit**: In progress
- **Used by**: Several dApps in production

We recommend starting with non-critical amounts while the ecosystem matures.

---

### Q: How do I get support?

**A:**

- **Discord**: https://discord.gg/sip-protocol
- **GitHub Issues**: https://github.com/sip-protocol/sip-protocol/issues
- **Docs**: https://docs.sip-protocol.org

Enterprise support available for large integrations.

---

### Q: Can I contribute?

**A:** Yes! We welcome contributions:

- **Code**: PRs to sip-protocol/sip-protocol
- **Docs**: Improve guides and examples
- **Testing**: Report bugs, edge cases
- **Ideas**: Feature requests via GitHub issues

---

*Have a question not answered here? Ask in Discord or open a GitHub issue.*
