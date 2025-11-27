[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / UnsignedTransaction

# Interface: UnsignedTransaction

Defined in: packages/types/dist/index.d.ts:1387

Unsigned transaction (chain-specific)

## Properties

### chain

> **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:1389

Target chain

***

### data

> **data**: `unknown`

Defined in: packages/types/dist/index.d.ts:1391

Transaction data (chain-specific format)

***

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: packages/types/dist/index.d.ts:1393

Optional transaction metadata
