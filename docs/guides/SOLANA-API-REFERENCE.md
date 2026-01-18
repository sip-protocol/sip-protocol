# Solana Privacy API Reference

Complete API documentation for Solana same-chain privacy operations in `@sip-protocol/sdk`.

## Table of Contents

- [Stealth Address Functions](#stealth-address-functions)
- [Transfer Functions](#transfer-functions)
- [Scanning Functions](#scanning-functions)
- [Transaction Builder](#transaction-builder)
- [RPC Providers](#rpc-providers)
- [Utility Functions](#utility-functions)
- [Types](#types)
- [Constants](#constants)

---

## Stealth Address Functions

### generateEd25519StealthMetaAddress

Generates a new stealth meta-address for Solana (ed25519 curve).

```typescript
function generateEd25519StealthMetaAddress(
  chain: 'solana' | 'near' | 'aptos' | 'sui'
): {
  metaAddress: StealthMetaAddress
  spendingPrivateKey: HexString
  viewingPrivateKey: HexString
}
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `chain` | `'solana' \| 'near' \| 'aptos' \| 'sui'` | Target blockchain |

**Returns:**
| Property | Type | Description |
|----------|------|-------------|
| `metaAddress` | `StealthMetaAddress` | Public meta-address to share |
| `spendingPrivateKey` | `HexString` | Private key for spending funds |
| `viewingPrivateKey` | `HexString` | Private key for scanning payments |

**Example:**
```typescript
import { generateEd25519StealthMetaAddress } from '@sip-protocol/sdk'

const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
  generateEd25519StealthMetaAddress('solana')

// Share metaAddress with senders
// Secure spendingPrivateKey and viewingPrivateKey
```

---

### generateEd25519StealthAddress

Generates a one-time stealth address for a recipient.

```typescript
function generateEd25519StealthAddress(
  metaAddress: StealthMetaAddress
): {
  stealthAddress: StealthAddress
  sharedSecret: HexString
}
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `metaAddress` | `StealthMetaAddress` | Recipient's meta-address |

**Returns:**
| Property | Type | Description |
|----------|------|-------------|
| `stealthAddress` | `StealthAddress` | One-time address with ephemeral key |
| `sharedSecret` | `HexString` | ECDH shared secret (for internal use) |

**StealthAddress structure:**
```typescript
interface StealthAddress {
  address: HexString           // The stealth public key
  ephemeralPublicKey: HexString // Published with transaction
  viewTag: number              // First byte for fast scanning
}
```

**Example:**
```typescript
import { generateEd25519StealthAddress } from '@sip-protocol/sdk'

const { stealthAddress } = generateEd25519StealthAddress(recipientMeta)

console.log('Send to:', stealthAddress.address)
console.log('Include in memo:', stealthAddress.ephemeralPublicKey)
```

---

### deriveEd25519StealthPrivateKey

Derives the private key for spending from a stealth address.

```typescript
function deriveEd25519StealthPrivateKey(
  stealthAddress: StealthAddress,
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString
): {
  stealthAddress: HexString
  ephemeralPublicKey: HexString
  privateKey: HexString
}
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `stealthAddress` | `StealthAddress` | The stealth address data |
| `spendingPrivateKey` | `HexString` | Your spending private key |
| `viewingPrivateKey` | `HexString` | Your viewing private key |

**Returns:**
| Property | Type | Description |
|----------|------|-------------|
| `privateKey` | `HexString` | Private key for this stealth address |

**Example:**
```typescript
import { deriveEd25519StealthPrivateKey } from '@sip-protocol/sdk'
import { Keypair } from '@solana/web3.js'

const { privateKey } = deriveEd25519StealthPrivateKey(
  payment.stealthAddressData,
  mySpendingPrivateKey,
  myViewingPrivateKey
)

const keypair = Keypair.fromSecretKey(
  Buffer.from(privateKey.slice(2), 'hex')
)
```

---

### checkEd25519StealthAddress

Checks if a stealth address belongs to you (for scanning).

```typescript
function checkEd25519StealthAddress(
  stealthAddress: StealthAddress,
  spendingPublicKey: HexString,
  viewingPrivateKey: HexString
): boolean
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `stealthAddress` | `StealthAddress` | Stealth address to check |
| `spendingPublicKey` | `HexString` | Your spending public key |
| `viewingPrivateKey` | `HexString` | Your viewing private key |

**Returns:** `boolean` — `true` if you own this stealth address

**Example:**
```typescript
import { checkEd25519StealthAddress } from '@sip-protocol/sdk'

const isMyPayment = checkEd25519StealthAddress(
  announcementData,
  metaAddress.spendingKey,
  viewingPrivateKey
)

if (isMyPayment) {
  // Derive claim key and process payment
}
```

---

### ed25519PublicKeyToSolanaAddress

Converts an ed25519 public key to a Solana base58 address.

```typescript
function ed25519PublicKeyToSolanaAddress(publicKey: HexString): string
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `publicKey` | `HexString` | ed25519 public key (hex) |

**Returns:** `string` — Solana base58 address

**Example:**
```typescript
import { ed25519PublicKeyToSolanaAddress } from '@sip-protocol/sdk'

const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
// '7xyz...ABC' (base58)
```

---

### encodeStealthMetaAddress / decodeStealthMetaAddress

Encode/decode stealth meta-addresses for sharing.

```typescript
function encodeStealthMetaAddress(metaAddress: StealthMetaAddress): string
function decodeStealthMetaAddress(encoded: string): StealthMetaAddress
```

**Format:** `sip:<chain>:<spendingKey>:<viewingKey>`

**Example:**
```typescript
import {
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
} from '@sip-protocol/sdk'

const encoded = encodeStealthMetaAddress(metaAddress)
// 'sip:solana:0x02abc...123:0x03def...456'

const decoded = decodeStealthMetaAddress(encoded)
// { chain: 'solana', spendingKey: '0x02abc...', viewingKey: '0x03def...' }
```

---

## Transfer Functions

### sendPrivateSOLTransfer

Send native SOL to a stealth address.

```typescript
async function sendPrivateSOLTransfer(
  params: SOLTransferParams
): Promise<SOLTransferResult>
```

**Parameters (SOLTransferParams):**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `connection` | `Connection` | Yes | Solana RPC connection |
| `sender` | `PublicKey` | Yes | Sender's public key |
| `recipientMetaAddress` | `StealthMetaAddress` | Yes | Recipient's meta-address |
| `amount` | `bigint` | Yes | Amount in lamports |
| `signTransaction` | `(tx: Transaction) => Promise<Transaction>` | Yes | Transaction signer |
| `priorityLevel` | `'low' \| 'medium' \| 'high'` | No | Priority fee level |
| `commitment` | `Commitment` | No | Confirmation commitment |
| `customMemo` | `string` | No | Additional memo |

**Returns (SOLTransferResult):**
| Property | Type | Description |
|----------|------|-------------|
| `signature` | `string` | Transaction signature |
| `stealthAddress` | `string` | Generated stealth address |
| `ephemeralPublicKey` | `string` | Ephemeral key (for scanning) |
| `viewTag` | `number` | View tag |
| `explorerUrl` | `string` | Block explorer URL |

**Example:**
```typescript
import { sendPrivateSOLTransfer } from '@sip-protocol/sdk'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

const result = await sendPrivateSOLTransfer({
  connection,
  sender: wallet.publicKey,
  recipientMetaAddress: recipientMeta,
  amount: BigInt(0.5 * LAMPORTS_PER_SOL),
  signTransaction: wallet.signTransaction,
  priorityLevel: 'medium',
})

console.log('TX:', result.signature)
```

**Errors:**
| Error | Cause |
|-------|-------|
| `InsufficientBalance` | Sender lacks funds |
| `InvalidMetaAddress` | Meta-address chain mismatch |
| `TransactionFailed` | RPC/signing error |

---

### sendPrivateSPLTransfer

Send SPL tokens to a stealth address.

```typescript
async function sendPrivateSPLTransfer(
  params: SolanaPrivateTransferParams
): Promise<SolanaPrivateTransferResult>
```

**Parameters (SolanaPrivateTransferParams):**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `connection` | `Connection` | Yes | Solana RPC connection |
| `sender` | `PublicKey` | Yes | Sender's public key |
| `senderTokenAccount` | `PublicKey` | No | Sender's ATA (auto-detected) |
| `recipientMetaAddress` | `StealthMetaAddress` | Yes | Recipient's meta-address |
| `mint` | `PublicKey` | Yes | Token mint address |
| `amount` | `bigint` | Yes | Amount (smallest unit) |
| `signTransaction` | `(tx) => Promise<tx>` | Yes | Transaction signer |
| `commitment` | `Commitment` | No | Confirmation commitment |
| `skipBalanceCheck` | `boolean` | No | Skip pre-validation |

**Returns:** Same structure as `sendPrivateSOLTransfer`

**Example:**
```typescript
import { sendPrivateSPLTransfer } from '@sip-protocol/sdk'
import { PublicKey } from '@solana/web3.js'

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')

const result = await sendPrivateSPLTransfer({
  connection,
  sender: wallet.publicKey,
  recipientMetaAddress: recipientMeta,
  mint: USDC_MINT,
  amount: 10_000_000n, // 10 USDC
  signTransaction: wallet.signTransaction,
})
```

---

### sendEnhancedSPLTransfer

Enhanced SPL transfer with token metadata resolution and validation.

```typescript
async function sendEnhancedSPLTransfer(
  params: EnhancedSPLTransferParams
): Promise<EnhancedSPLTransferResult>
```

**Additional features:**
- Automatic token metadata resolution
- Pre-transfer validation
- Balance checking
- ATA creation handling

**Example:**
```typescript
import { sendEnhancedSPLTransfer } from '@sip-protocol/sdk'

const result = await sendEnhancedSPLTransfer({
  connection,
  sender: wallet.publicKey,
  recipientMetaAddress,
  mint: USDC_MINT,
  amount: 100_000_000n,
  signTransaction: wallet.signTransaction,
})

console.log('Token:', result.tokenMetadata.symbol)
console.log('Formatted:', result.formattedAmount) // '100.00 USDC'
```

---

### validateSOLTransfer / validateTransfer

Pre-validate transfers before sending.

```typescript
async function validateSOLTransfer(
  params: Omit<SOLTransferParams, 'signTransaction'>
): Promise<SOLTransferValidation>

async function validateTransfer(
  params: Omit<EnhancedSPLTransferParams, 'signTransaction'>
): Promise<TransferValidation>
```

**Returns (TransferValidation):**
| Property | Type | Description |
|----------|------|-------------|
| `isValid` | `boolean` | Whether transfer can proceed |
| `errors` | `string[]` | Validation error messages |
| `senderBalance` | `TokenBalance` | Current balance |
| `estimatedFee` | `number` | Estimated transaction fee |
| `needsAtaCreation` | `boolean` | Whether stealth ATA needed |

**Example:**
```typescript
import { validateSOLTransfer } from '@sip-protocol/sdk'

const validation = await validateSOLTransfer({
  connection,
  sender: wallet.publicKey,
  recipientMetaAddress,
  amount: BigInt(LAMPORTS_PER_SOL),
})

if (!validation.isValid) {
  console.error('Errors:', validation.errors)
  return
}
```

---

## Scanning Functions

### scanForPayments

Scan for incoming stealth payments.

```typescript
async function scanForPayments(
  params: SolanaScanParams
): Promise<SolanaScanResult[]>
```

**Parameters (SolanaScanParams):**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `connection` | `Connection` | Yes | Solana RPC connection |
| `viewingPrivateKey` | `HexString` | Yes | Your viewing private key |
| `spendingPublicKey` | `HexString` | Yes | Your spending public key |
| `fromSlot` | `number` | No | Start scanning from slot |
| `toSlot` | `number` | No | Stop scanning at slot |
| `limit` | `number` | No | Max results to return |

**Returns (SolanaScanResult[]):**
| Property | Type | Description |
|----------|------|-------------|
| `stealthAddress` | `string` | The stealth address (base58) |
| `ephemeralPublicKey` | `string` | Ephemeral key |
| `viewTag` | `number` | View tag |
| `amount` | `bigint` | Transfer amount |
| `tokenMint` | `string \| null` | Token mint (null for SOL) |
| `slot` | `number` | Transaction slot |
| `signature` | `string` | Transaction signature |
| `claimed` | `boolean` | Whether already claimed |

**Example:**
```typescript
import { scanForPayments } from '@sip-protocol/sdk'

const payments = await scanForPayments({
  connection,
  viewingPrivateKey: myMeta.viewingPrivateKey,
  spendingPublicKey: myMeta.metaAddress.spendingKey,
  fromSlot: lastScannedSlot,
})

console.log(`Found ${payments.length} payments`)
```

---

### claimStealthPayment

Claim funds from a stealth address.

```typescript
async function claimStealthPayment(
  params: SolanaClaimParams
): Promise<SolanaClaimResult>
```

**Parameters (SolanaClaimParams):**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `connection` | `Connection` | Yes | Solana RPC connection |
| `stealthAddress` | `string` | Yes | Stealth address to claim from |
| `ephemeralPublicKey` | `string` | Yes | Ephemeral key from announcement |
| `viewingPrivateKey` | `HexString` | Yes | Your viewing private key |
| `spendingPrivateKey` | `HexString` | Yes | Your spending private key |
| `destinationAddress` | `string` | Yes | Where to send funds |
| `mint` | `PublicKey \| null` | No | Token mint (null for SOL) |

**Returns (SolanaClaimResult):**
| Property | Type | Description |
|----------|------|-------------|
| `signature` | `string` | Claim transaction signature |
| `amount` | `bigint` | Amount claimed |
| `explorerUrl` | `string` | Block explorer URL |

**Example:**
```typescript
import { claimStealthPayment } from '@sip-protocol/sdk'

const result = await claimStealthPayment({
  connection,
  stealthAddress: payment.stealthAddress,
  ephemeralPublicKey: payment.ephemeralPublicKey,
  viewingPrivateKey: myMeta.viewingPrivateKey,
  spendingPrivateKey: myMeta.spendingPrivateKey,
  destinationAddress: myMainWallet,
  mint: payment.tokenMint ? new PublicKey(payment.tokenMint) : null,
})
```

---

## Transaction Builder

### createTransactionBuilder

Create a transaction builder for advanced use cases.

```typescript
function createTransactionBuilder(
  config: TransactionBuilderConfig
): ShieldedTransactionBuilder
```

**TransactionBuilderConfig:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `connection` | `Connection` | Yes | Solana RPC connection |
| `feePayer` | `PublicKey` | Yes | Transaction fee payer |
| `priorityLevel` | `'low' \| 'medium' \| 'high'` | No | Priority fee level |
| `computeUnits` | `number` | No | Custom compute budget |

**ShieldedTransactionBuilder methods:**

```typescript
class ShieldedTransactionBuilder {
  // Build SOL transfer transaction
  async buildSOLTransfer(params: SOLTransferInstruction): Promise<BuiltTransaction>

  // Build SPL token transfer transaction
  async buildSPLTransfer(params: SPLTransferInstruction): Promise<BuiltTransaction>

  // Serialize for sending via external wallet
  serializeTransaction(tx: Transaction): SerializedTransaction

  // Estimate compute units needed
  estimateComputeUnits(instructions: TransactionInstruction[]): number
}
```

**Example:**
```typescript
import { createTransactionBuilder } from '@sip-protocol/sdk'

const builder = createTransactionBuilder({
  connection,
  feePayer: wallet.publicKey,
  priorityLevel: 'high',
})

const { transaction, stealthAddress } = await builder.buildSOLTransfer({
  sender: wallet.publicKey,
  recipientMetaAddress,
  amount: BigInt(LAMPORTS_PER_SOL),
})

// Sign with external wallet
const signed = await wallet.signTransaction(transaction)
const signature = await connection.sendRawTransaction(signed.serialize())
```

---

### estimateComputeUnits / calculatePriorityFee

Utility functions for transaction optimization.

```typescript
function estimateComputeUnits(
  instructions: TransactionInstruction[]
): number

function calculatePriorityFee(
  level: 'low' | 'medium' | 'high'
): number
```

**Priority fee levels:**
| Level | Microlamports per CU |
|-------|---------------------|
| `low` | 1,000 |
| `medium` | 10,000 |
| `high` | 100,000 |

---

## RPC Providers

### createProvider

Create an RPC provider instance.

```typescript
function createProvider(
  type: ProviderType,
  config: ProviderConfig
): SolanaRPCProvider
```

**Provider types:**
- `'helius'` — Helius with DAS API
- `'quicknode'` — QuickNode with gRPC
- `'triton'` — Triton RPC
- `'generic'` — Any Solana RPC

**HeliusProviderConfig:**
```typescript
interface HeliusProviderConfig {
  apiKey: string
  cluster?: 'mainnet-beta' | 'devnet'
  rateLimitRPS?: number
  enableCompression?: boolean
}
```

**GenericProviderConfig:**
```typescript
interface GenericProviderConfig {
  rpcUrl: string
  wsUrl?: string
  commitment?: Commitment
}
```

**SolanaRPCProvider interface:**
```typescript
interface SolanaRPCProvider {
  // Get connection
  getConnection(): Connection

  // Scan for SIP announcements
  scanAnnouncements(params: ScanParams): Promise<Announcement[]>

  // Get token balances
  getTokenBalances(address: string): Promise<TokenAsset[]>

  // Subscribe to new announcements
  subscribeToAnnouncements(
    callback: (announcement: Announcement) => void
  ): () => void
}
```

**Example:**
```typescript
import { createProvider } from '@sip-protocol/sdk'

// Helius (recommended)
const provider = createProvider('helius', {
  apiKey: process.env.HELIUS_API_KEY,
  cluster: 'mainnet-beta',
})

// Generic RPC
const genericProvider = createProvider('generic', {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
})
```

---

## Utility Functions

### formatTokenAmount / parseTokenAmount

Format and parse token amounts.

```typescript
function formatTokenAmount(amount: bigint, decimals: number): string
function parseTokenAmount(amount: string, decimals: number): bigint
```

**Example:**
```typescript
import { formatTokenAmount, parseTokenAmount } from '@sip-protocol/sdk'

const formatted = formatTokenAmount(1_000_000n, 6) // '1.000000'
const parsed = parseTokenAmount('1.5', 6) // 1_500_000n
```

---

### formatLamports / parseSOLToLamports

Format and parse SOL amounts.

```typescript
function formatLamports(lamports: bigint): string
function parseSOLToLamports(sol: string): bigint
```

**Example:**
```typescript
import { formatLamports, parseSOLToLamports } from '@sip-protocol/sdk'

const formatted = formatLamports(1_500_000_000n) // '1.5'
const parsed = parseSOLToLamports('0.5') // 500_000_000n
```

---

### createAnnouncementMemo / parseAnnouncement

Work with SIP announcement memos.

```typescript
function createAnnouncementMemo(
  ephemeralPublicKey: string,
  viewTag: string,
  stealthAddress?: string
): string

function parseAnnouncement(memo: string): SolanaAnnouncement | null
```

**Memo format:** `SIP:1:<ephemeralKey>:<viewTag>[:<stealthAddress>]`

**Example:**
```typescript
import { createAnnouncementMemo, parseAnnouncement } from '@sip-protocol/sdk'

const memo = createAnnouncementMemo(
  '7xyz...ABC',
  '0a',
  '9abc...DEF'
)
// 'SIP:1:7xyz...ABC:0a:9abc...DEF'

const parsed = parseAnnouncement(memo)
// { ephemeralPublicKey: '7xyz...ABC', viewTag: '0a', ... }
```

---

## Types

### Core Types

```typescript
// Stealth meta-address (public, shareable)
interface StealthMetaAddress {
  chain: 'solana' | 'near' | 'aptos' | 'sui'
  spendingKey: HexString
  viewingKey: HexString
}

// One-time stealth address
interface StealthAddress {
  address: HexString
  ephemeralPublicKey: HexString
  viewTag: number
}

// Hex string type
type HexString = `0x${string}`
```

### Transfer Types

```typescript
interface SOLTransferParams {
  connection: Connection
  sender: PublicKey
  recipientMetaAddress: StealthMetaAddress
  amount: bigint
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
  priorityLevel?: 'low' | 'medium' | 'high'
  commitment?: Commitment
  customMemo?: string
}

interface SOLTransferResult {
  signature: string
  stealthAddress: string
  ephemeralPublicKey: string
  viewTag: number
  explorerUrl: string
}

interface EnhancedSPLTransferParams extends SOLTransferParams {
  mint: PublicKey
  senderTokenAccount?: PublicKey
  skipBalanceCheck?: boolean
}
```

### Scan Types

```typescript
interface SolanaScanResult {
  stealthAddress: string
  ephemeralPublicKey: string
  viewTag: number
  amount: bigint
  tokenMint: string | null
  slot: number
  signature: string
  claimed: boolean
  timestamp: number
}

interface SolanaAnnouncement {
  ephemeralPublicKey: string
  viewTag: string
  stealthAddress?: string
  version: string
}
```

---

## Constants

### Token Constants

```typescript
import {
  SOLANA_TOKEN_MINTS,
  SOLANA_TOKEN_DECIMALS,
  getTokenMint,
  getSolanaTokenDecimals,
} from '@sip-protocol/sdk'

// Common token mints
SOLANA_TOKEN_MINTS.USDC   // 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
SOLANA_TOKEN_MINTS.USDT   // 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
SOLANA_TOKEN_MINTS.PYUSD  // '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo'

// Get mint by symbol
const usdcMint = getTokenMint('USDC') // PublicKey

// Get decimals
const decimals = getSolanaTokenDecimals('USDC') // 6
```

### Network Constants

```typescript
import {
  SOLANA_RPC_ENDPOINTS,
  SOLANA_EXPLORER_URLS,
  getExplorerUrl,
  type SolanaCluster,
} from '@sip-protocol/sdk'

// RPC endpoints
SOLANA_RPC_ENDPOINTS['mainnet-beta']
SOLANA_RPC_ENDPOINTS.devnet

// Explorer URLs
getExplorerUrl('tx', signature, 'mainnet-beta')
// 'https://solscan.io/tx/...'
```

### Transaction Constants

```typescript
import {
  MEMO_PROGRAM_ID,
  SIP_MEMO_PREFIX,
  ESTIMATED_TX_FEE_LAMPORTS,
  ATA_RENT_LAMPORTS,
  RENT_EXEMPT_MINIMUM,
  DEFAULT_COMPUTE_UNITS,
  DEFAULT_PRIORITY_FEE,
} from '@sip-protocol/sdk'

MEMO_PROGRAM_ID             // 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
SIP_MEMO_PREFIX            // 'SIP:1'
ESTIMATED_TX_FEE_LAMPORTS  // 5000
ATA_RENT_LAMPORTS          // 2039280
RENT_EXEMPT_MINIMUM        // 890880
DEFAULT_COMPUTE_UNITS      // 200000
DEFAULT_PRIORITY_FEE       // 10000
```

---

## Error Handling

All async functions throw typed errors:

```typescript
import { SIPError, TransferError, ScanError } from '@sip-protocol/sdk'

try {
  await sendPrivateSOLTransfer({...})
} catch (error) {
  if (error instanceof TransferError) {
    switch (error.code) {
      case 'INSUFFICIENT_BALANCE':
        console.error('Not enough SOL')
        break
      case 'INVALID_META_ADDRESS':
        console.error('Bad recipient address')
        break
      case 'TRANSACTION_FAILED':
        console.error('TX error:', error.message)
        break
    }
  }
}
```

**Common error codes:**
| Code | Description |
|------|-------------|
| `INSUFFICIENT_BALANCE` | Sender lacks required funds |
| `INVALID_META_ADDRESS` | Meta-address invalid or wrong chain |
| `INVALID_AMOUNT` | Amount is zero or negative |
| `TRANSACTION_FAILED` | RPC or signing error |
| `SCAN_FAILED` | Error during payment scanning |
| `CLAIM_FAILED` | Error claiming stealth payment |

---

## See Also

- [Developer Guide](./SOLANA-SAME-CHAIN-PRIVACY.md) — Getting started tutorial
- [Performance Benchmarks](../benchmarks/PERFORMANCE.md) — Operation timing
- [Stealth Addresses Deep-Dive](../content/articles/04-stealth-addresses-solana.md) — Cryptographic details

---

*Generated from @sip-protocol/sdk v0.6.0 | The Privacy Standard for Web3*
