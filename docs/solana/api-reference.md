# API Reference: Solana Privacy SDK

Complete API documentation for `@sip-protocol/sdk` Solana features.

## Installation

```bash
npm install @sip-protocol/sdk @solana/web3.js
```

## Core Functions

### shieldedTransfer

Execute a privacy-preserving SOL transfer using the Anchor program.

```typescript
import { shieldedTransfer } from '@sip-protocol/sdk'

const result = await shieldedTransfer({
  connection: Connection,      // Solana RPC connection
  sender: PublicKey,           // Sender's public key
  recipient: string | StealthMetaAddress,  // SIP address or meta-address object
  amount: bigint,              // Amount in lamports
  signTransaction: (tx) => Promise<Transaction>,  // Wallet signer
})
```

**Returns: `AnchorShieldedTransferResult`**

| Field | Type | Description |
|-------|------|-------------|
| `signature` | `string` | Transaction signature |
| `noteId` | `string` | Transfer record PDA (base58) |
| `stealthAddress` | `string` | One-time recipient address |
| `ephemeralPublicKey` | `HexString` | For recipient scanning |
| `commitment` | `HexString` | Pedersen commitment (33 bytes) |
| `viewTag` | `string` | View tag for fast filtering |
| `viewingKeyHash` | `HexString` | SHA256 of viewing key |
| `explorerUrl` | `string` | Solscan link |

---

### sendPrivateSPLTransfer

Send private SPL token transfer (USDC, etc).

```typescript
import { sendPrivateSPLTransfer } from '@sip-protocol/sdk'

const result = await sendPrivateSPLTransfer({
  connection: Connection,
  sender: PublicKey,
  senderTokenAccount: PublicKey,  // Sender's ATA
  recipientMetaAddress: StealthMetaAddress,
  mint: PublicKey,                // Token mint
  amount: bigint,                 // In smallest units
  signTransaction: (tx) => Promise<Transaction>,
})
```

---

### scanForPayments

Scan blockchain for incoming stealth payments.

```typescript
import { scanForPayments } from '@sip-protocol/sdk'

const payments = await scanForPayments({
  connection: Connection,
  viewingPrivateKey: HexString,   // Recipient's viewing key
  spendingPublicKey: HexString,   // Recipient's spending pubkey
  fromSlot?: number,              // Start scanning from slot
  limit?: number,                 // Max results
})
```

**Returns: `SolanaScanResult[]`**

| Field | Type | Description |
|-------|------|-------------|
| `stealthAddress` | `string` | Address holding funds |
| `ephemeralPublicKey` | `HexString` | For key derivation |
| `amount` | `bigint` | Decrypted amount |
| `viewTag` | `number` | View tag |
| `timestamp` | `number` | Unix timestamp |
| `noteId` | `string` | Transfer record PDA |

---

### claimStealthPayment

Claim funds from a stealth address.

```typescript
import { claimStealthPayment } from '@sip-protocol/sdk'

const result = await claimStealthPayment({
  connection: Connection,
  stealthAddress: string,
  ephemeralPublicKey: HexString,
  viewingPrivateKey: HexString,
  spendingPrivateKey: HexString,
  destinationAddress: PublicKey,  // Where to send funds
  mint?: PublicKey,               // For SPL tokens
})
```

---

## Stealth Address Functions

### generateStealthMetaAddress

Generate a new stealth meta-address (recipient identity).

```typescript
import { generateStealthMetaAddress } from '@sip-protocol/sdk'

const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
  generateStealthMetaAddress('solana')
```

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `metaAddress` | `StealthMetaAddress` | Shareable public address |
| `spendingPrivateKey` | `HexString` | For claiming (keep secret) |
| `viewingPrivateKey` | `HexString` | For scanning (can share with auditors) |

---

### encodeStealthMetaAddress

Encode meta-address to SIP URI format.

```typescript
import { encodeStealthMetaAddress } from '@sip-protocol/sdk'

const uri = encodeStealthMetaAddress(metaAddress)
// "sip:solana:0x02abc...123:0x03def...456"
```

---

### decodeStealthMetaAddress

Parse SIP URI to meta-address object.

```typescript
import { decodeStealthMetaAddress } from '@sip-protocol/sdk'

const meta = decodeStealthMetaAddress('sip:solana:0x02abc...:0x03def...')
// { chain: 'solana', spendingKey: '0x02abc...', viewingKey: '0x03def...' }
```

---

## Commitment Functions

### commit

Create a Pedersen commitment.

```typescript
import { commit } from '@sip-protocol/sdk'

const { commitment, blinding } = commit(1_000_000_000n)
// commitment: "0x02..." (33 bytes)
// blinding: "0x..." (32 bytes)
```

---

### verifyOpening

Verify a commitment opens to a value.

```typescript
import { verifyOpening } from '@sip-protocol/sdk'

const valid = verifyOpening(commitment, amount, blinding)
// true or false
```

---

## Viewing Key Functions

### computeViewingKeyHash

Compute SHA256 hash of viewing key (stored on-chain).

```typescript
import { computeViewingKeyHash } from '@sip-protocol/sdk'

const hash = computeViewingKeyHash(viewingPublicKey)
// "0x..." (32 bytes)
```

---

### encryptForViewing

Encrypt data with viewing key.

```typescript
import { encryptForViewing } from '@sip-protocol/sdk'

const encrypted = encryptForViewing(
  data: Uint8Array,
  viewingPublicKey: HexString
)
```

---

### decryptWithViewing

Decrypt data using viewing key.

```typescript
import { decryptWithViewing } from '@sip-protocol/sdk'

const data = decryptWithViewing(
  encrypted: EncryptedPayload,
  viewingPrivateKey: HexString
)
```

---

## RPC Providers

### createProvider

Create an RPC provider for enhanced functionality.

```typescript
import { createProvider } from '@sip-protocol/sdk'

// Helius (recommended)
const helius = createProvider('helius', {
  apiKey: 'your-api-key',
  cluster: 'mainnet-beta',
})

// Generic RPC
const generic = createProvider('generic', {
  endpoint: 'https://api.mainnet-beta.solana.com',
})
```

---

### HeliusProvider

Direct Helius provider for DAS API access.

```typescript
import { HeliusProvider } from '@sip-protocol/sdk'

const provider = new HeliusProvider({
  apiKey: 'xxx',
  cluster: 'mainnet-beta',
})

// Get token assets
const assets = await provider.getTokenAssets(walletAddress)
```

---

## Constants

### Program IDs

```typescript
import {
  SIP_PRIVACY_PROGRAM_ID,  // Main program
  CONFIG_PDA,              // Config account
  FEE_COLLECTOR,           // Fee destination
} from '@sip-protocol/sdk'
```

### Token Mints

```typescript
import { SOLANA_TOKEN_MINTS } from '@sip-protocol/sdk'

SOLANA_TOKEN_MINTS.USDC  // EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
SOLANA_TOKEN_MINTS.USDT  // Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
```

### Cluster Endpoints

```typescript
import { SOLANA_RPC_ENDPOINTS } from '@sip-protocol/sdk'

SOLANA_RPC_ENDPOINTS.mainnet  // https://api.mainnet-beta.solana.com
SOLANA_RPC_ENDPOINTS.devnet   // https://api.devnet.solana.com
```

---

## Types

### StealthMetaAddress

```typescript
interface StealthMetaAddress {
  chain: 'solana' | 'ethereum' | ...
  spendingKey: HexString  // Compressed ed25519 pubkey
  viewingKey: HexString   // Compressed ed25519 pubkey
}
```

### HexString

```typescript
type HexString = `0x${string}`  // Hex-encoded bytes with 0x prefix
```

### AnchorShieldedTransferParams

```typescript
interface AnchorShieldedTransferParams {
  connection: Connection
  sender: PublicKey
  recipient: string | StealthMetaAddress
  amount: bigint
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
}
```

---

## Error Handling

```typescript
import { ValidationError } from '@sip-protocol/sdk'

try {
  await shieldedTransfer({ ... })
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid input:', error.field, error.message)
  }
}
```

---

## Next Steps

- [Quickstart](./quickstart.md) - Get started in 5 minutes
- [Architecture](./architecture.md) - How it works
- [Examples](./examples/) - Code samples
