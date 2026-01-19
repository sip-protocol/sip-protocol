# Uniswap V3 Private Swap Example

This example demonstrates how to execute a private swap through Uniswap V3 using SIP Protocol's stealth addresses and Pedersen commitments.

## Overview

A private swap involves:
1. **Input Privacy**: Funds come from a stealth address (unlinkable to your main wallet)
2. **Output Privacy**: Swap output goes to a new stealth address
3. **Amount Privacy**: Pedersen commitments hide the actual amounts

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Stealth Input  │────▶│  Uniswap V3  │────▶│ Stealth Output  │
│   (ETH/Token)   │     │    Router    │     │   (Token/ETH)   │
└─────────────────┘     └──────────────┘     └─────────────────┘
        │                                            │
        │                                            │
        ▼                                            ▼
┌─────────────────┐                        ┌─────────────────┐
│  SIP Announcer  │                        │  SIP Announcer  │
│ (publish ephem) │                        │ (publish ephem) │
└─────────────────┘                        └─────────────────┘
```

## Prerequisites

```bash
npm install @sip-protocol/sdk ethers
```

## Usage

```typescript
import { privateUniswapSwap } from './private-swap'

// Execute private swap: ETH -> USDC
const result = await privateUniswapSwap({
  // Your stealth meta-address (generated once, reuse)
  recipientMetaAddress: 'sip:ethereum:0x02abc...123:0x03def...456',

  // Input token (use zero address for ETH)
  inputToken: '0x0000000000000000000000000000000000000000',
  inputAmount: '1.0', // 1 ETH

  // Output token
  outputToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC

  // Slippage tolerance
  slippagePercent: 0.5,

  // Connected wallet signer
  signer,
})

console.log('Swap tx:', result.swapTxHash)
console.log('Stealth address:', result.stealthAddress)
console.log('Ephemeral pubkey:', result.ephemeralPublicKey)
```

## How It Works

### Step 1: Generate Stealth Output Address

```typescript
import { generateEthereumStealthAddress } from '@sip-protocol/sdk'

// Generate one-time stealth address for receiving swap output
const stealth = generateEthereumStealthAddress(recipientMetaAddress)
// stealth.stealthAddress.ethAddress = '0x...' (fresh address)
// stealth.stealthAddress.ephemeralPublicKey = '0x...' (for recipient)
```

### Step 2: Build Uniswap V3 Swap Transaction

```typescript
import { SwapRouter } from '@uniswap/v3-sdk'

// Standard Uniswap V3 swap, but output goes to stealth address
const swapParams = {
  tokenIn: inputToken,
  tokenOut: outputToken,
  fee: 3000, // 0.3%
  recipient: stealth.stealthAddress.ethAddress, // Stealth address!
  amountIn: inputAmount,
  amountOutMinimum: minOutput,
  sqrtPriceLimitX96: 0,
}
```

### Step 3: Announce Stealth Address

```typescript
import { encodeAnnouncementCallData } from '@sip-protocol/sdk'

// Publish ephemeral key so recipient can find their payment
const announcementData = encodeAnnouncementCallData({
  schemeId: 1, // secp256k1
  stealthAddress: stealth.stealthAddress.ethAddress,
  ephemeralPublicKey: stealth.stealthAddress.ephemeralPublicKey,
  viewTag: stealth.stealthAddress.viewTag,
})
```

### Step 4: Execute Multicall (Swap + Announce)

```typescript
// Both transactions in one atomic operation
const multicall = [
  swapRouter.interface.encodeFunctionData('exactInputSingle', [swapParams]),
  announcer.interface.encodeFunctionData('announce', [announcementData]),
]
```

## Privacy Considerations

1. **Input Address**: Should be a stealth address from a previous payment, not your main wallet
2. **Gas Payment**: Consider using a relayer (Gelato) to avoid linking gas payer to swap
3. **Timing**: Random delays between receiving funds and swapping can improve privacy
4. **Amount Obfuscation**: Split large swaps into multiple smaller ones

## Network Support

| Network | Uniswap V3 Router | SIP Announcer |
|---------|-------------------|---------------|
| Mainnet | `0xE592...` | `0x...` |
| Arbitrum | `0xE592...` | `0x...` |
| Optimism | `0xE592...` | `0x...` |
| Base | `0x2626...` | `0x...` |
| Polygon | `0xE592...` | `0x...` |

## Gas Costs

| Operation | Mainnet | L2 (Base) |
|-----------|---------|-----------|
| Swap only | ~150k | ~150k |
| Announcement | ~80k | ~80k |
| **Total** | ~230k | ~230k |

L2 cost: ~$0.05 vs Mainnet: ~$15 (at 30 gwei)

## Security Notes

- Always verify the stealth address before sending funds
- Use a hardware wallet for signing large transactions
- The ephemeral public key is public - this is by design
- Only the recipient with the viewing key can identify the payment

## Related

- [SIP Ethereum Privacy Guide](https://docs.sip-protocol.org/ethereum)
- [Uniswap V3 Documentation](https://docs.uniswap.org/contracts/v3/overview)
- [EIP-5564 Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
