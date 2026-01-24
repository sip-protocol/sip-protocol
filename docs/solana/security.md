# Security Guide: Solana Privacy

Security considerations and best practices for SIP Protocol integration.

## Key Management

### Private Key Hierarchy

```
Spending Key (most sensitive)
├── Controls funds
├── Used to claim payments
├── NEVER share with anyone
└── Store in secure enclave / hardware wallet

Viewing Key (can be shared selectively)
├── Allows reading payment amounts
├── Share with auditors/regulators if needed
├── Cannot spend funds
└── Store encrypted, backup securely
```

### Storage Recommendations

| Platform | Spending Key | Viewing Key |
|----------|--------------|-------------|
| Web | Browser extension wallet | Encrypted localStorage |
| Mobile | Secure Enclave / Keychain | Secure storage |
| Desktop | Hardware wallet | Encrypted file |
| Server | HSM / Vault | Encrypted database |

### Code Example: Secure Storage

```typescript
// React Native
import * as SecureStore from 'expo-secure-store'

async function storeKeys(spending: string, viewing: string) {
  await SecureStore.setItemAsync('sip_spending', spending, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
  await SecureStore.setItemAsync('sip_viewing', viewing)
}

// Web (with password encryption)
import { xchacha20poly1305 } from '@noble/ciphers/chacha'

function encryptWithPassword(data: string, password: string): string {
  const key = deriveKey(password) // Use Argon2 or PBKDF2
  const nonce = randomBytes(24)
  const cipher = xchacha20poly1305(key, nonce)
  const encrypted = cipher.encrypt(new TextEncoder().encode(data))
  return bytesToHex(concat(nonce, encrypted))
}
```

## Transaction Privacy

### What's Hidden

| Element | Status | Notes |
|---------|--------|-------|
| Amount | Hidden | Via Pedersen commitment |
| Recipient | Hidden | Via stealth address |
| Sender | Visible | v1 limitation (shielded sender in v2) |
| Timestamp | Visible | Block timestamp |
| Token type | Visible | Mint address |

### Privacy Leaks to Avoid

```typescript
// BAD: Logging sensitive data
console.log('Sending to:', recipientAddress, 'amount:', amount)

// GOOD: Log only non-sensitive info
console.log('Transaction submitted:', signature)

// BAD: Amount in URL
window.location.href = `/confirm?amount=${amount}&to=${address}`

// GOOD: Use session storage or state
sessionStorage.setItem('pending_tx', JSON.stringify({ id: txId }))
```

### Timing Attacks

Claim timing can leak information. Mitigations:

```typescript
// Add random delay before claiming
async function claimWithDelay(payment: Payment) {
  const delay = Math.random() * 60000 // 0-60 seconds
  await sleep(delay)
  return claimStealthPayment({ ... })
}

// Batch claims
async function batchClaim(payments: Payment[]) {
  // Wait for multiple payments before claiming
  if (payments.length < 5) {
    console.log('Waiting for more payments before batch claim')
    return
  }
  // Claim all at once
  for (const p of payments) {
    await claimStealthPayment({ ...p })
  }
}
```

## Input Validation

### Validate SIP Addresses

```typescript
import { decodeStealthMetaAddress } from '@sip-protocol/sdk'

function validateRecipient(address: string): boolean {
  try {
    const meta = decodeStealthMetaAddress(address)
    return meta.chain === 'solana'
  } catch {
    return false
  }
}
```

### Validate Amounts

```typescript
function validateAmount(amount: bigint, balance: bigint): string | null {
  if (amount <= 0n) {
    return 'Amount must be positive'
  }
  if (amount > balance) {
    return 'Insufficient balance'
  }
  // Leave room for fees (~0.01 SOL)
  if (amount > balance - 10_000_000n) {
    return 'Insufficient balance for fees'
  }
  return null
}
```

## RPC Security

### Use Authenticated Endpoints

```typescript
// BAD: Public RPC (rate limited, potentially unreliable)
const connection = new Connection('https://api.mainnet-beta.solana.com')

// GOOD: Authenticated provider
const connection = new Connection(
  `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_KEY}`
)
```

### Verify Transaction Data

```typescript
// Always verify transaction before signing
async function safeSign(tx: Transaction, wallet: Wallet) {
  // Check transaction is what you expect
  const instructions = tx.instructions

  // Verify program ID
  const sipInstruction = instructions.find(
    i => i.programId.equals(SIP_PRIVACY_PROGRAM_ID)
  )
  if (!sipInstruction) {
    throw new Error('Invalid transaction: missing SIP instruction')
  }

  // Verify you're the fee payer
  if (!tx.feePayer?.equals(wallet.publicKey)) {
    throw new Error('Invalid transaction: wrong fee payer')
  }

  return wallet.signTransaction(tx)
}
```

## Viewing Key Disclosure

### When to Share Viewing Keys

| Scenario | Share? | Notes |
|----------|--------|-------|
| Tax reporting | Yes | Required by law in most jurisdictions |
| Audit request | Maybe | Consult legal counsel |
| Exchange KYC | Maybe | Depends on exchange policy |
| Suspicious activity | Maybe | May be legally required |
| Random request | No | Verify legitimacy first |

### Disclosure Implementation

```typescript
import { exportViewingKey, createDisclosure } from '@sip-protocol/sdk'

// Export viewing key for auditor
const viewingKeyExport = exportViewingKey(viewingPrivateKey, {
  format: 'json',
  includePublicKey: true,
})

// Create disclosure for specific transactions
const disclosure = await createDisclosure({
  viewingKey: viewingPrivateKey,
  transactions: [txId1, txId2],
  purpose: 'Tax audit 2025',
  auditor: 'auditor@example.com',
})
```

## Common Vulnerabilities

### 1. Key Extraction via XSS

```typescript
// VULNERABLE: Keys accessible to any script
window.sipKeys = { spending: '...', viewing: '...' }

// SAFE: Keys in isolated context
// Use Web Workers or iframe isolation
const worker = new Worker('crypto-worker.js')
worker.postMessage({ action: 'sign', txData })
```

### 2. Phishing SIP Addresses

```typescript
// Always verify addresses match expected format
const SIP_ADDRESS_REGEX = /^sip:solana:0x[0-9a-f]{66}:0x[0-9a-f]{66}$/i

function isSipAddress(addr: string): boolean {
  return SIP_ADDRESS_REGEX.test(addr)
}
```

### 3. Amount Manipulation

```typescript
// VULNERABLE: Amount from URL parameter
const amount = new URLSearchParams(location.search).get('amount')
await shieldedTransfer({ amount: BigInt(amount) }) // User could be tricked

// SAFE: User confirms amount
const confirmed = await showConfirmDialog(
  `Send ${formatAmount(amount)} SOL to ${shortenAddress(recipient)}?`
)
if (!confirmed) return
```

## Incident Response

### If Spending Key Compromised

1. **Immediately** claim all pending payments to new address
2. Generate new SIP address
3. Notify senders to update your address
4. Do NOT reuse compromised keys

### If Viewing Key Compromised

1. Less critical - funds are safe
2. Privacy of past transactions is lost
3. Consider generating new identity if privacy is paramount
4. Viewing key cannot be used to spend

## Network Privacy (Tor/SOCKS5)

On-chain privacy hides transaction details, but network metadata can still leak:
- **IP address** connects to RPC (correlation with wallet activity)
- **Timing patterns** between requests
- **Request fingerprinting** (unique request patterns)

### Using Tor for Network Privacy

```typescript
import { createPrivateRPCClient } from '@sip-protocol/sdk'

// Route all RPC calls through Tor
const client = await createPrivateRPCClient({
  endpoint: 'https://api.mainnet-beta.solana.com',
  networkPrivacy: {
    proxy: 'tor',           // Auto-detect local Tor
    rotateCircuit: true,    // New identity per operation
    torControlPassword: process.env.TOR_PASSWORD,
  },
})

// All RPC calls now go through Tor
const balance = await client.getBalance(publicKey)

// Rotate circuit for unlinkability between operations
await client.rotateTorCircuit()
```

### Privacy Level Matrix

| Level | On-Chain | Network | Use Case |
|-------|----------|---------|----------|
| Basic | ✅ Stealth addresses | ❌ IP visible | Low-value, low-sensitivity |
| Standard | ✅ Stealth + commitments | ❌ IP visible | Most users |
| **Full** | ✅ Complete privacy | ✅ Tor/SOCKS5 | High-value, high-sensitivity |

### Setting Up Tor

```bash
# macOS
brew install tor
tor  # Starts on port 9050

# Ubuntu/Debian
sudo apt install tor
sudo systemctl start tor

# With control port (for circuit rotation)
# Edit /etc/tor/torrc:
#   ControlPort 9051
#   HashedControlPassword <your-hash>
```

### Using Custom SOCKS5 Proxy

```typescript
const client = await createPrivateRPCClient({
  endpoint: 'https://api.mainnet-beta.solana.com',
  networkPrivacy: {
    proxy: 'socks5://127.0.0.1:1080',
  },
})
```

### Environment Variable Configuration

```bash
# Set proxy globally
export SIP_PROXY=tor
# or
export SIP_PROXY=socks5://127.0.0.1:1080
```

### Network Privacy Limitations

- Browser: SOCKS5 not directly supported (use browser extension/system proxy)
- Performance: ~2-5x slower through Tor (acceptable for privacy-critical operations)
- Reliability: Tor circuits may fail; use fallback endpoints

## Security Checklist

- [ ] Spending keys stored in secure enclave / hardware wallet
- [ ] Viewing keys encrypted at rest
- [ ] No sensitive data in logs or URLs
- [ ] Using authenticated RPC endpoints
- [ ] Input validation on all user inputs
- [ ] Transaction verification before signing
- [ ] Random delays on claims (anti-timing)
- [ ] XSS protection (CSP headers, input sanitization)
- [ ] Regular dependency updates
- [ ] **Network privacy enabled for sensitive operations (Tor/SOCKS5)**

## Reporting Vulnerabilities

Found a security issue? Please report responsibly:

- Email: security@sip-protocol.org
- Do NOT disclose publicly until fixed
- Include reproduction steps
- We offer bug bounties for critical issues

## Next Steps

- [API Reference](./api-reference.md) - Full SDK documentation
- [Examples](./examples/) - Code samples
