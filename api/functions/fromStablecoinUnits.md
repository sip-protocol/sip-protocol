[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / fromStablecoinUnits

# Function: fromStablecoinUnits()

> **fromStablecoinUnits**(`units`, `symbol`): `number`

Defined in: [packages/sdk/src/payment/stablecoins.ts:276](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/stablecoins.ts#L276)

Convert smallest units to human-readable amount

## Parameters

### units

`bigint`

Amount in smallest units

### symbol

[`StablecoinSymbol`](../type-aliases/StablecoinSymbol.md)

Stablecoin symbol

## Returns

`number`

Human-readable amount

## Example

```typescript
fromStablecoinUnits(100500000n, 'USDC') // 100.5
fromStablecoinUnits(100500000000000000000n, 'DAI') // 100.5
```
