[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / UnsignedTransaction

# Interface: UnsignedTransaction

Defined in: packages/types/dist/index.d.ts:2216

Unsigned transaction (chain-specific)

## Properties

### chain

> **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:2218

Target chain

***

### data

> **data**: `unknown`

Defined in: packages/types/dist/index.d.ts:2220

Transaction data (chain-specific format)

***

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: packages/types/dist/index.d.ts:2222

Optional transaction metadata
