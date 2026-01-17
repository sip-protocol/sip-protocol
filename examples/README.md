# SIP Protocol Examples

Complete integration examples demonstrating real-world usage of SIP Protocol.

## Quick Start

```bash
# From repository root
pnpm install

# Run any example
npx ts-node examples/<example-name>/index.ts
```

## Available Examples

### Chain-Specific Integration

| Example | Description | Key Concepts |
|---------|-------------|--------------|
| [Solana Integration](./solana-integration/) | **Solana-native privacy** (ed25519 stealth) | SPL transfers, scanning, wallet adapters |
| [NEAR Integration](./near-integration/) | **NEAR privacy + cross-chain** (ed25519 + Intents) | Implicit accounts, NEP-141, 1Click API |
| [Ethereum Integration](./ethereum-integration/) | **Ethereum privacy** (secp256k1 stealth) | ETH/ERC-20, MetaMask, ERC-4337 |
| [React Hooks](./react-hooks/) | React integration patterns | useStealthTransfer, useScanPayments |
| [Range SAS](./range-sas/) | Compliance with attestations | Viewing key delegation, auditor workflows |

### Core Concepts

| Example | Description | Key Concepts |
|---------|-------------|--------------|
| [Private Payment](./private-payment/) | Send/receive with stealth addresses | Stealth meta-address, scanning, key recovery |
| [Private Swap](./private-swap/) | Cross-chain swap with privacy | Shielded intents, NEAR Intents, quotes |
| [Compliance](./compliance/) | Selective disclosure for auditors | Viewing keys, encryption, hierarchical keys |
| [Wallet Integration](./wallet-integration/) | Connect to Phantom, MetaMask, Ledger | Wallet adapters, signing, multi-chain |
| [Zcash Connection](./zcash-connection/) | Connect to zcashd node | RPC client, ShieldedService, testnet |

## Example Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. PRIVATE PAYMENT                                               │
│    Learn stealth addresses and payment scanning                 │
│                                                                  │
│    npx ts-node examples/private-payment/index.ts                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. PRIVATE SWAP                                                  │
│    Add cross-chain swaps with shielded intents                  │
│                                                                  │
│    npx ts-node examples/private-swap/index.ts                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. COMPLIANCE                                                    │
│    Add viewing keys for regulatory compliance                   │
│                                                                  │
│    npx ts-node examples/compliance/index.ts                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. WALLET INTEGRATION                                            │
│    Connect real wallets and sign transactions                   │
│                                                                  │
│    npx ts-node examples/wallet-integration/index.ts             │
└─────────────────────────────────────────────────────────────────┘
```

## Example Details

### Private Payment

Learn the fundamentals of stealth addresses:

- Generate reusable stealth meta-address
- Create one-time addresses for payments
- Scan for incoming payments
- Derive private keys to claim funds

```typescript
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  deriveStealthPrivateKey,
} from '@sip-protocol/sdk'

// Recipient publishes meta-address
const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
  generateStealthMetaAddress('ethereum')

// Sender creates one-time address
const { stealthAddress } = generateStealthAddress(metaAddress)

// Recipient scans and claims
if (checkStealthAddress(stealthAddress, spendingPrivateKey, viewingPrivateKey)) {
  const recovery = deriveStealthPrivateKey(stealthAddress, spendingPrivateKey, viewingPrivateKey)
  // Use recovery.privateKey to claim funds
}
```

### Private Swap

Execute cross-chain swaps with privacy:

- Create shielded intents with hidden amounts
- Get quotes from NEAR Intents solvers
- Execute and track swap status

```typescript
import { SIP, PrivacyLevel, createShieldedIntent } from '@sip-protocol/sdk'

const sip = new SIP({ network: 'mainnet' })

const intent = await createShieldedIntent({
  input: { chain: 'solana', token: 'SOL', amount: 1_000_000_000n },
  output: { chain: 'ethereum', token: 'ETH' },
  privacy: PrivacyLevel.SHIELDED,
})

const quotes = await sip.getQuotes(intent)
const result = await sip.execute(intent, quotes[0], { wallet })
```

### Compliance

Add selective disclosure for regulators:

- Generate hierarchical viewing keys
- Encrypt transaction data
- Auditors decrypt only authorized scope

```typescript
import {
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing,
} from '@sip-protocol/sdk'

// Organization creates master key
const masterKey = generateViewingKey('m/treasury')

// Derive scoped key for auditor
const auditorKey = deriveViewingKey(masterKey, 'auditor/2024')

// Encrypt transaction for auditor
const encrypted = encryptForViewing(txData, auditorKey)

// Auditor decrypts
const revealed = decryptWithViewing(encrypted, auditorKey)
```

### Wallet Integration

Connect to real wallets:

- Solana (Phantom, Solflare)
- Ethereum (MetaMask, WalletConnect)
- Hardware (Ledger, Trezor)

```typescript
import { createSolanaAdapter, createEthereumAdapter } from '@sip-protocol/sdk'

// Solana
const solanaWallet = createSolanaAdapter({ providerName: 'Phantom' })
await solanaWallet.connect()

// Ethereum
const ethWallet = createEthereumAdapter({ providerName: 'MetaMask' })
await ethWallet.connect()

// Sign transaction
const signature = await wallet.signMessage(message)
```

## Running with Real Networks

### Mainnet Quotes

```bash
LIVE_QUOTES=true npx ts-node examples/private-swap/index.ts
```

### Zcash Testnet

```bash
ZCASH_RPC_USER=user ZCASH_RPC_PASS=pass npx ts-node examples/zcash-connection/index.ts
```

See [docs/guides/ZCASH-TESTNET.md](../docs/guides/ZCASH-TESTNET.md) for full setup instructions.

## Project Structure

```
examples/
├── README.md                    # This file
├── private-payment/
│   ├── README.md               # Detailed documentation
│   ├── package.json            # Dependencies
│   └── index.ts                # Main example
├── private-swap/
│   ├── README.md
│   ├── package.json
│   └── index.ts
├── compliance/
│   ├── README.md
│   ├── package.json
│   └── index.ts
├── wallet-integration/
│   ├── README.md
│   ├── package.json
│   └── index.ts
└── zcash-connection/
    ├── README.md               # Testnet setup, API reference
    ├── package.json
    └── index.ts                # RPC client + ShieldedService example
```

## Dependencies

Each example uses:

- `@sip-protocol/sdk` - Core SIP Protocol SDK
- `ts-node` - TypeScript execution
- `typescript` - Type checking

## Contributing

To add a new example:

1. Create directory: `examples/<name>/`
2. Add `README.md` with documentation
3. Add `package.json` with dependencies
4. Add `index.ts` with runnable code
5. Update this README

## Support

- [Documentation](https://docs.sip-protocol.org)
- [GitHub Issues](https://github.com/sip-protocol/sip-protocol/issues)
- [Discord](https://discord.gg/sip-protocol)
