[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashUnspentNote

# Interface: ZcashUnspentNote

Defined in: packages/types/dist/index.d.ts:1098

Unspent note (shielded UTXO)

## Properties

### txid

> **txid**: `string`

Defined in: packages/types/dist/index.d.ts:1100

Transaction ID

***

### pool

> **pool**: [`ZcashPool`](../type-aliases/ZcashPool.md)

Defined in: packages/types/dist/index.d.ts:1102

Value pool

***

### outindex

> **outindex**: `number`

Defined in: packages/types/dist/index.d.ts:1104

Output index

***

### confirmations

> **confirmations**: `number`

Defined in: packages/types/dist/index.d.ts:1106

Number of confirmations

***

### spendable

> **spendable**: `boolean`

Defined in: packages/types/dist/index.d.ts:1108

Whether spendable by this wallet

***

### address

> **address**: `string`

Defined in: packages/types/dist/index.d.ts:1110

The shielded address

***

### amount

> **amount**: `number`

Defined in: packages/types/dist/index.d.ts:1112

Value in ZEC

***

### memo

> **memo**: `string`

Defined in: packages/types/dist/index.d.ts:1114

Memo field (hex)

***

### memoStr?

> `optional` **memoStr**: `string`

Defined in: packages/types/dist/index.d.ts:1116

Memo as UTF-8 if valid

***

### change

> **change**: `boolean`

Defined in: packages/types/dist/index.d.ts:1118

Whether this is change

***

### jsindex?

> `optional` **jsindex**: `number`

Defined in: packages/types/dist/index.d.ts:1120

Sprout: joinsplit index

***

### jsoutindex?

> `optional` **jsoutindex**: `number`

Defined in: packages/types/dist/index.d.ts:1122

Sprout: joinsplit output index
