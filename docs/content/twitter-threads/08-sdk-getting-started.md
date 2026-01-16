# Thread 8: Getting Started with SIP SDK

**Hook:** Add privacy to your dApp in 3 lines of code. No PhD required.

---

**1/**
Add privacy to your dApp in 3 lines of code.

No PhD required.

Here's how to get started with @sipprotocol SDK 🧵

**2/**
Install:

```bash
npm install @sip-protocol/sdk
```

That's it. Works in Node, browser, React.

**3/**
Generate a private receiving address:

```typescript
import { generateStealthMetaAddress, encodeStealthMetaAddress } from '@sip-protocol/sdk'

const meta = generateStealthMetaAddress()
const address = encodeStealthMetaAddress(meta)
// sip:solana:0x02abc...
```

**4/**
Send to a private address:

```typescript
import { generateStealthAddress } from '@sip-protocol/sdk'

const stealth = generateStealthAddress(recipientMeta)
// Send to stealth.stealthAddress
// Include stealth.ephemeralPublicKey in memo
```

**5/**
Scan for incoming payments:

```typescript
import { scanForPayments, createProvider } from '@sip-protocol/sdk'

const payments = await scanForPayments({
  provider: createProvider('helius', { apiKey }),
  viewingPrivateKey: meta.viewingKey.privateKey,
  spendingPublicKey: meta.spendingKey.publicKey,
})
```

**6/**
That's the core loop:

1. Generate address (once)
2. Send to stealth address
3. Scan for payments
4. Claim to main wallet

Everything else builds on these primitives.

**7/**
For React apps:

```bash
npm install @sip-protocol/react
```

```typescript
import { useStealthAddress, usePrivateSend } from '@sip-protocol/react'

const { address, scan } = useStealthAddress()
const { send } = usePrivateSend()
```

**8/**
Privacy levels:

```typescript
import { PrivacyLevel } from '@sip-protocol/sdk'

// No privacy (legacy behavior)
PrivacyLevel.TRANSPARENT

// Full privacy
PrivacyLevel.SHIELDED

// Privacy + viewing key
PrivacyLevel.COMPLIANT
```

**9/**
Creating intents (cross-chain):

```typescript
const sip = new SIP({ network: 'mainnet' })

const intent = await sip.createIntent({
  input: { chain: 'solana', token: 'SOL', amount: 10n },
  output: { chain: 'ethereum', token: 'ETH' },
  privacy: PrivacyLevel.SHIELDED,
})
```

**10/**
Key management tips:

```typescript
// Spending key: store securely (never expose)
meta.spendingKey.privateKey

// Viewing key: share with auditors (read-only)
meta.viewingKey.privateKey

// Use secureWipe after operations
import { secureWipe } from '@sip-protocol/sdk'
```

**11/**
RPC providers:

```typescript
// Helius (recommended for Solana)
createProvider('helius', { apiKey: '...' })

// QuickNode
createProvider('quicknode', { apiKey: '...' })

// Generic RPC
createProvider('generic', { rpcUrl: '...' })
```

**12/**
Testing on devnet:

```typescript
const sip = new SIP({
  network: 'testnet', // Uses devnet
})

const provider = createProvider('helius', {
  apiKey: HELIUS_KEY,
  cluster: 'devnet',
})
```

**13/**
Full example in 20 lines:

```typescript
import { generateStealthMetaAddress, scanForPayments, createProvider } from '@sip-protocol/sdk'

// Setup
const meta = generateStealthMetaAddress()
const provider = createProvider('helius', { apiKey })

// Share this address
const receiveAddress = encodeStealthMetaAddress(meta)

// Later: check for payments
const payments = await scanForPayments({
  provider,
  viewingPrivateKey: meta.viewingKey.privateKey,
  spendingPublicKey: meta.spendingKey.publicKey,
})

console.log(`Found ${payments.length} payments`)
```

**14/**
Next steps:

📚 Quick-start guides: docs.sip-protocol.org/guides
💻 GitHub: github.com/sip-protocol
🎮 Interactive demo: app.sip-protocol.org
💬 Discord: discord.gg/sip-protocol

Questions? Ask in Discord!

---

**Engagement CTA:** "What's the first thing you'd build with private payments?"

**Hashtags:** #Solana #Web3Dev #BuildOnSolana
