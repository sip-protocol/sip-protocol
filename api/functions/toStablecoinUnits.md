[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / toStablecoinUnits

# Function: toStablecoinUnits()

> **toStablecoinUnits**(`amount`, `symbol`): `bigint`

Defined in: [packages/sdk/src/payment/stablecoins.ts:257](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/stablecoins.ts#L257)

Convert human-readable amount to smallest units

## Parameters

### amount

`number`

Human-readable amount (e.g., 100.50)

### symbol

[`StablecoinSymbol`](../type-aliases/StablecoinSymbol.md)

Stablecoin symbol

## Returns

`bigint`

Amount in smallest units (e.g., 100500000 for USDC)

## Example

```typescript
toStablecoinUnits(100.50, 'USDC') // 100500000n (6 decimals)
toStablecoinUnits(100.50, 'DAI')  // 100500000000000000000n (18 decimals)
```
