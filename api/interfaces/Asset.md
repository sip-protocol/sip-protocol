[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / Asset

# Interface: Asset

Defined in: packages/types/dist/index.d.ts:158

Token/asset identifier

## Properties

### chain

> **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:160

Chain the asset is on

***

### symbol

> **symbol**: `string`

Defined in: packages/types/dist/index.d.ts:162

Token symbol (e.g., 'SOL', 'ETH', 'USDC')

***

### address

> **address**: `` `0x${string}` `` \| `null`

Defined in: packages/types/dist/index.d.ts:164

Token contract address (null for native tokens)

***

### decimals

> **decimals**: `number`

Defined in: packages/types/dist/index.d.ts:166

Number of decimals
