[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / formatStablecoinAmount

# Function: formatStablecoinAmount()

> **formatStablecoinAmount**(`units`, `symbol`, `options?`): `string`

Defined in: [packages/sdk/src/payment/stablecoins.ts:290](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/stablecoins.ts#L290)

Format stablecoin amount for display

## Parameters

### units

`bigint`

Amount in smallest units

### symbol

[`StablecoinSymbol`](../type-aliases/StablecoinSymbol.md)

Stablecoin symbol

### options?

Formatting options

#### includeSymbol?

`boolean`

#### minimumFractionDigits?

`number`

#### maximumFractionDigits?

`number`

## Returns

`string`

Formatted string (e.g., "100.50 USDC")
