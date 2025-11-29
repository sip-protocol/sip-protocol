[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / getStablecoinsForChain

# Function: getStablecoinsForChain()

> **getStablecoinsForChain**(`chain`): [`Asset`](../interfaces/Asset.md)[]

Defined in: [packages/sdk/src/payment/stablecoins.ts:194](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/stablecoins.ts#L194)

Get all supported stablecoins for a chain

## Parameters

### chain

[`ChainId`](../type-aliases/ChainId.md)

Target chain

## Returns

[`Asset`](../interfaces/Asset.md)[]

Array of available stablecoin assets

## Example

```typescript
const ethStables = getStablecoinsForChain('ethereum')
// [USDC, USDT, DAI, BUSD, FRAX, LUSD, PYUSD]
```
