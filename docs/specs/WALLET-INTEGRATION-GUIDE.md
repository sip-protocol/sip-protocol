# SIP Wallet Integration Guide

**Status:** Draft
**Version:** 1.0.0
**Last Updated:** 2026-01-20
**Related:** [SIP-EIP](./SIP-EIP.md), [Working Group Charter](./WORKING-GROUP-CHARTER.md)

---

## Executive Summary

This guide provides wallet providers with everything needed to integrate SIP (Shielded Intents Protocol) privacy features. Wallet support is critical for user-facing privacy—wallets are the primary touchpoint where users interact with privacy toggles, stealth addresses, and viewing keys.

**Goal:** Minimize wallet-side implementation burden while maximizing privacy capabilities.

**Key Integration Points:**
- Privacy toggle UI component
- Stealth address generation and scanning
- Viewing key management
- Transaction status display

---

## 1. Target Wallet Providers

### 1.1 Priority Tiers

| Tier | Wallet | Chain Focus | Users | Priority | Contact Status |
|------|--------|-------------|-------|----------|----------------|
| **1** | MetaMask | EVM | 30M+ | Critical | 🔲 Not contacted |
| **1** | Phantom | Solana | 3M+ | Critical | 🔲 Not contacted |
| **1** | NEAR Wallet | NEAR | 1M+ | Critical | 🔲 Not contacted |
| **2** | Rainbow | EVM | 500K+ | High | 🔲 Not contacted |
| **2** | Rabby | EVM | 500K+ | High | 🔲 Not contacted |
| **2** | Backpack | Solana/EVM | 500K+ | High | 🔲 Not contacted |
| **3** | Coinbase Wallet | Multi | 10M+ | Medium | 🔲 Not contacted |
| **3** | Trust Wallet | Multi | 25M+ | Medium | 🔲 Not contacted |
| **3** | Ledger Live | Hardware | 5M+ | Medium | 🔲 Not contacted |

### 1.2 Wallet-Specific Considerations

#### MetaMask (Extension + Mobile)

```
Platform: Browser Extension, Mobile App
Architecture: Snap-based extensibility
Key Contact: MetaMask Snaps team
Integration Path: MetaMask Snap or native integration
```

**Opportunities:**
- Snaps allow third-party privacy features
- Large developer ecosystem
- Strong security review process

**Challenges:**
- Strict review process for Snaps
- Performance constraints in extension
- Mobile parity requirements

#### Phantom (Solana-First)

```
Platform: Browser Extension, Mobile App
Architecture: Native integration
Key Contact: Phantom developer relations
Integration Path: Native feature or plugin
```

**Opportunities:**
- Primary Solana wallet = aligned with SIP Solana focus
- Aggressive feature development
- Strong privacy culture

**Challenges:**
- Smaller team than MetaMask
- Multi-chain expansion ongoing
- Performance-sensitive (Solana speed)

#### NEAR Wallet (MyNearWallet, Meteor)

```
Platform: Web, Mobile
Architecture: NEAR-specific
Key Contact: NEAR Wallet teams
Integration Path: Native NEAR Intents integration
```

**Opportunities:**
- Native Intents support
- Direct SIP origin story connection
- Strong NEAR Foundation relationship

**Challenges:**
- Fragmented wallet ecosystem
- Smaller user base
- Multiple wallet implementations

---

## 2. Integration Architecture

### 2.1 Minimal Integration (SDK-Only)

Wallets can integrate SIP with minimal code changes by using the SDK:

```
┌─────────────────────────────────────────────────────────────────┐
│                         WALLET APP                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────────────────────────────┐     │
│  │  Privacy    │    │           @sip-protocol/sdk          │     │
│  │  Toggle UI  │───▶│  • createStealthAddress()           │     │
│  └─────────────┘    │  • scanForPayments()                │     │
│                     │  • createViewingKey()               │     │
│  ┌─────────────┐    │  • encryptForRecipient()            │     │
│  │  Stealth    │───▶│                                     │     │
│  │  Display    │    └─────────────────────────────────────┘     │
│  └─────────────┘                     │                          │
│                                      ▼                          │
│                     ┌─────────────────────────────────────┐     │
│                     │            Blockchain RPC            │     │
│                     └─────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Effort:** ~2-4 weeks
**Lines of Code:** ~500-1000

### 2.2 Full Integration (Native Privacy)

For wallets wanting deeper integration:

```
┌─────────────────────────────────────────────────────────────────┐
│                         WALLET APP                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Privacy Layer                         │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │    │
│  │  │  Stealth  │  │  Viewing  │  │    Commitment     │   │    │
│  │  │  Address  │  │    Key    │  │     Manager       │   │    │
│  │  │  Manager  │  │  Manager  │  │                   │   │    │
│  │  └───────────┘  └───────────┘  └───────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Core Wallet                           │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │    │
│  │  │  Account  │  │   Signer  │  │    Transaction    │   │    │
│  │  │  Manager  │  │           │  │      Builder      │   │    │
│  │  └───────────┘  └───────────┘  └───────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Effort:** ~2-3 months
**Lines of Code:** ~5000-10000

### 2.3 WalletConnect Integration

For wallets supporting WalletConnect v2:

```typescript
// SIP namespace for WalletConnect
const SIP_NAMESPACE = {
  chains: ['eip155:1', 'solana:mainnet', 'near:mainnet'],
  methods: [
    'sip_createStealthAddress',
    'sip_scanPayments',
    'sip_getViewingKey',
    'sip_signShieldedTransaction',
  ],
  events: [
    'sip_paymentReceived',
    'sip_stealthAddressUsed',
  ],
}
```

---

## 3. UX Requirements

### 3.1 Privacy Toggle Design

The privacy toggle is the primary user interaction point.

#### Required States

```
┌─────────────────────────────────────────┐
│  Privacy Level                          │
├─────────────────────────────────────────┤
│                                         │
│  ○ Public        Standard transaction   │
│                  Everyone can see       │
│                                         │
│  ◉ Private       Shielded transaction   │
│                  Hidden from public     │
│                                         │
│  ○ Compliant     Private + audit key    │
│                  Hidden but auditable   │
│                                         │
└─────────────────────────────────────────┘
```

#### Toggle Component Specification

```typescript
interface PrivacyToggleProps {
  // Current privacy level
  level: 'transparent' | 'shielded' | 'compliant'

  // Callback when user changes level
  onChange: (level: PrivacyLevel) => void

  // Whether to show advanced options
  showAdvanced?: boolean

  // Disable toggle (e.g., during transaction)
  disabled?: boolean

  // Custom labels (for i18n)
  labels?: {
    transparent?: string
    shielded?: string
    compliant?: string
  }
}
```

#### Visual Guidelines

| Aspect | Requirement |
|--------|-------------|
| **Visibility** | Always visible in transaction flow |
| **Default** | `transparent` (user must opt-in to privacy) |
| **Feedback** | Clear visual change when toggled |
| **Education** | Tooltip explaining each level |
| **Persistence** | Remember user's preference |

### 3.2 Stealth Address Display

#### Display Format

```
┌─────────────────────────────────────────┐
│  Receiving Address                      │
├─────────────────────────────────────────┤
│                                         │
│  🔒 Stealth Address (Private)           │
│                                         │
│  sip:solana:02a1b2...f3e4:03d5e6...a7b8│
│                                         │
│  [Copy]  [QR Code]  [Share Viewing Key] │
│                                         │
└─────────────────────────────────────────┘
```

#### Address Parsing

```typescript
interface StealthAddressDisplay {
  // Full SIP address
  fullAddress: string

  // Parsed components
  chain: string
  spendingKey: string  // Truncated for display
  viewingKey: string   // Truncated for display

  // Display helpers
  truncated: string    // e.g., "sip:sol:02a1...e4:03d5...b8"
  qrCodeData: string   // Full address for QR
}

function formatStealthAddress(address: string): StealthAddressDisplay {
  const [prefix, chain, spending, viewing] = address.split(':')

  return {
    fullAddress: address,
    chain,
    spendingKey: spending,
    viewingKey: viewing,
    truncated: `${prefix}:${chain.slice(0,3)}:${spending.slice(0,4)}...${spending.slice(-2)}:${viewing.slice(0,4)}...${viewing.slice(-2)}`,
    qrCodeData: address,
  }
}
```

### 3.3 Transaction Status

#### Private Transaction Flow

```
┌─────────────────────────────────────────┐
│  Transaction Status                     │
├─────────────────────────────────────────┤
│                                         │
│  🔒 Private Transfer                    │
│                                         │
│  Status: Confirmed ✓                    │
│                                         │
│  Amount: Hidden                         │
│  To: Stealth Address                    │
│  Fee: 0.00025 SOL                       │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Only you and the recipient can see     │
│  the transaction details.               │
│                                         │
│  [View with Viewing Key]                │
│                                         │
└─────────────────────────────────────────┘
```

### 3.4 Viewing Key Management

#### Key Export UI

```
┌─────────────────────────────────────────┐
│  Viewing Keys                           │
├─────────────────────────────────────────┤
│                                         │
│  Your viewing keys allow others to      │
│  see your transaction history.          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Incoming Viewing Key              │  │
│  │ See payments received             │  │
│  │ [Export] [Share]                  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Full Viewing Key                  │  │
│  │ See all transaction history       │  │
│  │ ⚠️ Only share with auditors       │  │
│  │ [Export] [Share]                  │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

#### Viewing Key Types

| Key Type | Visibility | Use Case |
|----------|------------|----------|
| **Incoming** | Payments received | Tax reporting |
| **Outgoing** | Payments sent | Expense tracking |
| **Full** | All transactions | Full audit |

---

## 4. SDK Integration Guide

### 4.1 Installation

```bash
# npm
npm install @sip-protocol/sdk

# yarn
yarn add @sip-protocol/sdk

# pnpm
pnpm add @sip-protocol/sdk
```

### 4.2 Basic Integration

```typescript
import {
  createStealthAddress,
  scanForPayments,
  createViewingKey,
  PrivacyLevel,
} from '@sip-protocol/sdk'

// Generate stealth address for receiving
const stealthAddress = await createStealthAddress({
  chain: 'solana',
  spendingPublicKey: wallet.publicKey,
})

// Scan for incoming payments
const payments = await scanForPayments({
  viewingPrivateKey: wallet.viewingKey,
  spendingPublicKey: wallet.publicKey,
  fromBlock: lastScannedBlock,
})

// Create viewing key for auditor
const viewingKey = await createViewingKey({
  type: 'incoming',
  privateKey: wallet.privateKey,
})
```

### 4.3 React Integration

```tsx
import {
  SIPProvider,
  usePrivacyToggle,
  useStealthAddress,
  useViewingKeys,
} from '@sip-protocol/react'

function WalletApp() {
  return (
    <SIPProvider>
      <SendTransaction />
    </SIPProvider>
  )
}

function SendTransaction() {
  const { level, setLevel } = usePrivacyToggle()
  const { address, generate } = useStealthAddress()

  return (
    <div>
      <PrivacyToggle value={level} onChange={setLevel} />

      {level !== 'transparent' && (
        <StealthAddressDisplay address={address} />
      )}

      <TransactionForm privacyLevel={level} />
    </div>
  )
}
```

### 4.4 Mobile (React Native)

```tsx
import {
  SIPProvider,
  usePrivacyToggle,
} from '@sip-protocol/react-native'

function MobileWallet() {
  const { level, setLevel } = usePrivacyToggle()

  return (
    <SIPProvider>
      <View>
        <PrivacyToggle value={level} onChange={setLevel} />
        <SendScreen privacyLevel={level} />
      </View>
    </SIPProvider>
  )
}
```

---

## 5. Security Requirements

### 5.1 Key Storage

| Key Type | Storage Requirement | Encryption |
|----------|---------------------|------------|
| Spending Private Key | Secure enclave / hardware | Required |
| Viewing Private Key | Encrypted storage | Required |
| Stealth Address | Can be public | N/A |
| Blinding Factors | Encrypted, ephemeral | Required |

### 5.2 Key Derivation

```typescript
// Recommended: Derive SIP keys from wallet master key
const sipKeys = await deriveSIPKeys({
  masterKey: wallet.masterKey,
  path: "m/44'/501'/0'/0'",  // Solana example
  sipVersion: 1,
})

// Keys derived deterministically
const { spendingKeyPair, viewingKeyPair } = sipKeys
```

### 5.3 Security Checklist

- [ ] Spending keys stored in secure enclave when available
- [ ] Viewing keys encrypted at rest
- [ ] Blinding factors wiped after transaction
- [ ] No key material logged
- [ ] Secure key export with user confirmation
- [ ] Viewing key sharing requires explicit user action

---

## 6. Testing Requirements

### 6.1 Unit Tests

```typescript
describe('SIP Integration', () => {
  it('generates valid stealth address', async () => {
    const address = await createStealthAddress({ chain: 'solana' })
    expect(address).toMatch(/^sip:solana:0x[a-f0-9]+:0x[a-f0-9]+$/)
  })

  it('scans payments correctly', async () => {
    const payments = await scanForPayments({ ... })
    expect(payments).toBeInstanceOf(Array)
  })

  it('creates valid viewing key', async () => {
    const key = await createViewingKey({ type: 'incoming' })
    expect(key.type).toBe('incoming')
  })
})
```

### 6.2 Integration Tests

```typescript
describe('Full Privacy Flow', () => {
  it('completes private transaction end-to-end', async () => {
    // 1. Sender creates shielded transaction
    const tx = await createShieldedTransaction({
      recipient: recipientStealthAddress,
      amount: 1000000n,
      privacyLevel: 'shielded',
    })

    // 2. Transaction submitted
    const signature = await wallet.signAndSend(tx)

    // 3. Recipient scans and finds payment
    const payments = await scanForPayments({
      viewingPrivateKey: recipientViewingKey,
    })

    expect(payments).toHaveLength(1)
    expect(payments[0].amount).toBe(1000000n)
  })
})
```

### 6.3 Testnet Deployment

| Chain | Testnet | Faucet |
|-------|---------|--------|
| Solana | Devnet | https://faucet.solana.com |
| Ethereum | Sepolia | https://sepoliafaucet.com |
| NEAR | Testnet | https://near-faucet.io |

---

## 7. Wallet Provider Outreach

### 7.1 Outreach Template

**Subject:** SIP Protocol Integration - Privacy for [Wallet Name] Users

```
Hi [Name],

I'm [Your Name] from the SIP Protocol team. We're building the privacy
standard for Web3 - think HTTPS for blockchain transactions.

We'd love to discuss bringing privacy features to [Wallet Name] users:

What SIP offers:
• One-toggle privacy (transparent ↔ shielded ↔ compliant)
• Stealth addresses for unlinkable receiving
• Viewing keys for compliance/tax reporting
• Multi-chain support (Solana, EVM, NEAR)

Integration is lightweight:
• SDK: @sip-protocol/sdk (~50KB)
• React components: @sip-protocol/react
• Implementation: 2-4 weeks for basic integration

We've designed SIP to minimize wallet-side burden while maximizing
user privacy. Our SDK handles all the cryptography.

Resources:
• Integration Guide: [link]
• Live Demo: [link]
• SDK Docs: [link]

Would you have 30 minutes to discuss? We're flexible on timing and
happy to do a technical deep-dive with your engineering team.

Best,
[Your Name]
SIP Protocol Team
```

### 7.2 Contact Channels

| Wallet | Primary Channel | Secondary |
|--------|-----------------|-----------|
| MetaMask | DevRel team, Snaps Discord | Twitter DM |
| Phantom | Discord #developers | Twitter DM |
| Rainbow | Discord | GitHub issues |
| NEAR Wallet | NEAR Discord | Direct email |

### 7.3 Follow-Up Template

**Subject:** Re: SIP Protocol Integration - Next Steps

```
Hi [Name],

Following up on my previous email about SIP Protocol integration.

Quick recap of value for [Wallet Name]:
1. Differentiation: First-mover on privacy features
2. User demand: Privacy is consistently requested
3. Low effort: SDK handles complexity

I've prepared:
• Technical architecture diagram
• Integration timeline estimate
• Reference implementation

Happy to share any of these. Would a 15-minute call work this week?

Best,
[Your Name]
```

---

## 8. Tracking Dashboard

### 8.1 Wallet Engagement Status

| Wallet | Status | Contact | Last Update | Next Action |
|--------|--------|---------|-------------|-------------|
| MetaMask | 🔲 Not Started | TBD | - | Initial outreach |
| Phantom | 🔲 Not Started | TBD | - | Initial outreach |
| NEAR Wallet | 🔲 Not Started | TBD | - | Initial outreach |
| Rainbow | 🔲 Not Started | TBD | - | Initial outreach |
| Rabby | 🔲 Not Started | TBD | - | Initial outreach |
| Backpack | 🔲 Not Started | TBD | - | Initial outreach |

### 8.2 Integration Progress

```
MetaMask Integration:
├── 🔲 Initial Contact
├── 🔲 Technical Discussion
├── 🔲 Proof of Concept
├── 🔲 Integration Development
├── 🔲 Security Review
├── 🔲 Beta Testing
└── 🔲 Production Release

Phantom Integration:
├── 🔲 Initial Contact
├── 🔲 Technical Discussion
├── 🔲 Proof of Concept
├── 🔲 Integration Development
├── 🔲 Security Review
├── 🔲 Beta Testing
└── 🔲 Production Release
```

### 8.3 Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Wallets contacted | 6 | 0 |
| Technical discussions | 4 | 0 |
| POC integrations | 2 | 0 |
| Pilot commitments | 1 | 0 |

---

## 9. FAQ for Wallet Developers

### Q: How much work is integration?

**A:** Minimal integration takes 2-4 weeks with ~500-1000 lines of code. The SDK handles all cryptography—you just need to add UI components.

### Q: Does this affect transaction performance?

**A:** Negligible. Stealth address generation is <10ms. The main overhead is the one-time scan for incoming payments, which can be done in background.

### Q: What about gas/fees?

**A:** On most chains, shielded transactions have similar fees to normal transactions. The commitment is just additional data.

### Q: How does this affect compliance?

**A:** SIP includes viewing keys specifically for compliance. Users can generate audit keys for regulators while maintaining privacy from the public.

### Q: Is this audited?

**A:** Yes, the core cryptographic primitives are audited. We use battle-tested libraries (@noble/curves, @noble/hashes).

### Q: What chains are supported?

**A:** Solana (primary), EVM chains (Ethereum, Arbitrum, etc.), and NEAR. More chains planned.

### Q: Can users opt-out?

**A:** Yes, privacy is opt-in. The default is transparent transactions. Users explicitly choose privacy levels.

---

## 10. Resources

### 10.1 Documentation

| Resource | URL |
|----------|-----|
| SDK Documentation | https://docs.sip-protocol.org/sdk |
| React Components | https://docs.sip-protocol.org/react |
| API Reference | https://docs.sip-protocol.org/api |
| Security Model | https://docs.sip-protocol.org/security |

### 10.2 Code Repositories

| Repo | Purpose |
|------|---------|
| `sip-protocol/sip-protocol` | Core SDK monorepo |
| `sip-protocol/wallet-examples` | Example integrations |
| `sip-protocol/sip-app` | Reference application |

### 10.3 Support Channels

| Channel | Purpose |
|---------|---------|
| Discord #wallet-integration | Technical support |
| GitHub Issues | Bug reports |
| Email: integrations@sip-protocol.org | Partnership inquiries |

---

## Appendix A: Wallet-Specific Notes

### A.1 MetaMask Snap Considerations

```typescript
// MetaMask Snap manifest
{
  "version": "1.0.0",
  "proposedName": "SIP Privacy",
  "description": "Privacy features for MetaMask",
  "permissions": {
    "snap_dialog": {},
    "snap_manageState": {},
    "endowment:rpc": {
      "dapps": true,
      "snaps": false
    }
  }
}
```

### A.2 Phantom Deep Link Support

```typescript
// Phantom deep link for private transaction
const deepLink = `phantom://sip/send?` +
  `recipient=${encodeURIComponent(stealthAddress)}` +
  `&amount=${amount}` +
  `&privacyLevel=shielded`
```

### A.3 WalletConnect v2 Session

```typescript
// WalletConnect session with SIP support
const session = await client.connect({
  requiredNamespaces: {
    sip: {
      methods: ['sip_createStealthAddress', 'sip_signShielded'],
      chains: ['solana:mainnet'],
      events: ['sip_paymentReceived'],
    },
  },
})
```

---

*This guide is maintained by the SIP Protocol team. For questions, reach out on Discord or GitHub.*
