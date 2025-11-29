[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashAccountBalance

# Interface: ZcashAccountBalance

Defined in: packages/types/dist/index.d.ts:1111

Account balance result

## Properties

### pools

> **pools**: `object`

Defined in: packages/types/dist/index.d.ts:1113

Balances per pool

#### transparent?

> `optional` **transparent**: [`ZcashPoolBalance`](ZcashPoolBalance.md)

#### sapling?

> `optional` **sapling**: [`ZcashPoolBalance`](ZcashPoolBalance.md)

#### orchard?

> `optional` **orchard**: [`ZcashPoolBalance`](ZcashPoolBalance.md)

***

### minimum\_confirmations

> **minimum\_confirmations**: `number`

Defined in: packages/types/dist/index.d.ts:1119

Minimum confirmations used
