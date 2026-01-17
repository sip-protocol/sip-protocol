# Ethereum Privacy Integration Examples

Complete examples demonstrating SIP Protocol's Ethereum integration, including ETH and ERC-20 private transfers with stealth addresses.

## Overview

SIP Protocol provides Ethereum privacy through secp256k1 stealth addresses (EIP-5564 style):

1. **ETH Private Transfers** - Send native ETH to stealth addresses
2. **ERC-20 Private Transfers** - Send any ERC-20 token privately
3. **Gas-Sponsored Transactions** - Use ERC-4337 relayers for gasless claims

## Quick Start

```bash
# From repository root
pnpm install

# Run basic transfer example
npx ts-node examples/ethereum-integration/01-basic-eth-transfer.ts

# Run ERC-20 transfer example
npx ts-node examples/ethereum-integration/02-erc20-transfer.ts

# Run wallet integration example
npx ts-node examples/ethereum-integration/05-metamask-integration.ts
```

## Examples

| File | Description |
|------|-------------|
| [01-basic-eth-transfer.ts](./01-basic-eth-transfer.ts) | Send ETH to stealth addresses |
| [02-erc20-transfer.ts](./02-erc20-transfer.ts) | Send ERC-20 tokens privately |
| [03-scan-and-claim.ts](./03-scan-and-claim.ts) | Scan for and claim payments |
| [04-batch-transfer.ts](./04-batch-transfer.ts) | Multi-recipient batch transfers |
| [05-metamask-integration.ts](./05-metamask-integration.ts) | MetaMask wallet integration |
| [06-viewing-key-disclosure.ts](./06-viewing-key-disclosure.ts) | Compliance with viewing keys |

## Architecture

### Stealth Address Flow (EIP-5564 Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SENDER (Any EVM Wallet)                                                    │
│  1. Get recipient's stealth meta-address                                    │
│  2. Generate one-time stealth address (secp256k1)                           │
│  3. Send ETH/ERC-20 to stealth address                                      │
│  4. Emit announcement event                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETHEREUM BLOCKCHAIN                                                        │
│  - Stealth address = derived Ethereum address (keccak256 of public key)     │
│  - Native ETH transfer or ERC-20 transfer                                   │
│  - Announcement via SIP Registry contract (optional)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RECIPIENT                                                                  │
│  1. Scan announcements with viewing key                                     │
│  2. Check view tags for efficient filtering                                 │
│  3. Derive stealth private key                                              │
│  4. Claim funds via direct tx or ERC-4337 relayer                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Gas-Sponsored Claims (ERC-4337)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLAIMING WITH GAS SPONSORSHIP                                              │
│                                                                             │
│  Problem: Stealth addresses have no ETH for gas                             │
│  Solution: ERC-4337 Account Abstraction with Paymaster                      │
│                                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐                   │
│  │   Stealth   │───▶│   Bundler    │───▶│   Paymaster   │                   │
│  │   Address   │    │  (Pimlico)   │    │ (Gas Sponsor) │                   │
│  └─────────────┘    └──────────────┘    └───────────────┘                   │
│        │                   │                    │                           │
│        │                   ▼                    ▼                           │
│        │           ┌─────────────────────────────┐                          │
│        └──────────▶│   Main Wallet Receives     │                          │
│                    │   Tokens (Gas-Free)        │                          │
│                    └─────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### secp256k1 Stealth Addresses

Ethereum uses secp256k1 for all cryptographic operations:

```typescript
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  publicKeyToEthAddress,
} from '@sip-protocol/sdk'

// Generate Ethereum-compatible stealth meta-address
const recipient = generateStealthMetaAddress('ethereum', 'My Wallet')
// Keys are 33-byte compressed secp256k1 public keys

// Generate one-time stealth address
const { stealthAddress, sharedSecret } = generateStealthAddress(recipient.metaAddress)

// Convert stealth public key to Ethereum address
const ethAddress = publicKeyToEthAddress(stealthAddress.address)
// => "0x742d35Cc6634C0532925a3b844Bc9e7595f0aB12"
```

### View Tags for Efficient Scanning

View tags (first byte of shared secret hash) enable fast scanning:

```typescript
// Quick rejection: if view tag doesn't match, skip expensive computation
if (announcement.viewTag !== computedViewTag) {
  continue // Not our payment
}

// Only do full check if view tag matches (1/256 chance)
const isOurs = checkStealthAddress(stealthAddress, spendingKey, viewingKey)
```

### ERC-4337 Account Abstraction

Use relayers for gas-sponsored claims:

```typescript
import { createPimlicoRelayer } from '@sip-protocol/sdk/evm'

const relayer = createPimlicoRelayer({
  apiKey: process.env.PIMLICO_API_KEY,
  chain: 'ethereum',
})

// Claim tokens without needing ETH for gas
const result = await relayer.relayTransaction({
  to: tokenContract,
  data: transferCalldata,
  signer: stealthPrivateKey,
})
```

## Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Ethereum Mainnet | 1 | Supported |
| Ethereum Sepolia | 11155111 | Supported |
| Polygon | 137 | Supported |
| Arbitrum One | 42161 | Supported |
| Optimism | 10 | Supported |
| Base | 8453 | Supported |

## Environment Variables

```bash
# Optional: RPC endpoints (defaults to public endpoints)
ETHEREUM_RPC_URL=https://eth.llamarpc.com
SEPOLIA_RPC_URL=https://rpc.sepolia.org

# Optional: For gas-sponsored claims
PIMLICO_API_KEY=your_pimlico_api_key

# Optional: For wallet connection tests
PRIVATE_KEY=your_test_private_key  # NEVER use mainnet keys
```

## Important Notes

### Address Derivation

Ethereum addresses are derived from secp256k1 public keys:

1. Decompress public key to 65 bytes (uncompressed)
2. Remove 0x04 prefix (take last 64 bytes)
3. keccak256 hash of the 64 bytes
4. Take last 20 bytes as address
5. Apply EIP-55 checksum

### Gas Considerations

Stealth addresses start with 0 ETH balance. Options for claiming:

1. **Direct funding**: Send ETH to stealth address first
2. **ERC-4337 relayer**: Use paymaster for gas sponsorship
3. **Meta-transactions**: Use GSN or similar

### Multi-Chain Privacy

Same stealth meta-address works across all EVM chains:

```typescript
// Generate once, use everywhere
const recipient = generateStealthMetaAddress('ethereum', 'Multi-Chain')

// Same meta-address works on Polygon, Arbitrum, etc.
// Each chain gets different stealth addresses (unlinkable)
```

### Announcement Registry

For production, emit announcements via SIP Registry contract:

```solidity
// SIP Registry (EIP-5564 style)
event Announcement(
    uint256 indexed schemeId,
    address indexed stealthAddress,
    address indexed caller,
    bytes ephemeralPubKey,
    bytes metadata
);
```

## Resources

- [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [ERC-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [SIP Protocol Documentation](https://docs.sip-protocol.org)
- [Ethereum JSON-RPC API](https://ethereum.org/en/developers/docs/apis/json-rpc/)

## License

MIT - SIP Protocol
