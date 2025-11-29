[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / getStablecoin

# Function: getStablecoin()

> **getStablecoin**(`symbol`, `chain`): [`Asset`](../interfaces/Asset.md) \| `null`

Defined in: [packages/sdk/src/payment/stablecoins.ts:168](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/stablecoins.ts#L168)

Get stablecoin asset for a specific chain

## Parameters

### symbol

[`StablecoinSymbol`](../type-aliases/StablecoinSymbol.md)

Stablecoin symbol (e.g., 'USDC')

### chain

[`ChainId`](../type-aliases/ChainId.md)

Target chain

## Returns

[`Asset`](../interfaces/Asset.md) \| `null`

Asset object or null if not available on chain

## Example

```typescript
const usdc = getStablecoin('USDC', 'ethereum')
// { chain: 'ethereum', symbol: 'USDC', address: '0xa0b8...', decimals: 6 }

const usdcSol = getStablecoin('USDC', 'solana')
// { chain: 'solana', symbol: 'USDC', address: 'EPjF...', decimals: 6 }
```
