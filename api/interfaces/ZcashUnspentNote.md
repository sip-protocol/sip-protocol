[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashUnspentNote

# Interface: ZcashUnspentNote

Defined in: packages/types/dist/index.d.ts:1128

Unspent note (shielded UTXO)

## Properties

### txid

> **txid**: `string`

Defined in: packages/types/dist/index.d.ts:1130

Transaction ID

***

### pool

> **pool**: [`ZcashPool`](../type-aliases/ZcashPool.md)

Defined in: packages/types/dist/index.d.ts:1132

Value pool

***

### outindex

> **outindex**: `number`

Defined in: packages/types/dist/index.d.ts:1134

Output index

***

### confirmations

> **confirmations**: `number`

Defined in: packages/types/dist/index.d.ts:1136

Number of confirmations

***

### spendable

> **spendable**: `boolean`

Defined in: packages/types/dist/index.d.ts:1138

Whether spendable by this wallet

***

### address

> **address**: `string`

Defined in: packages/types/dist/index.d.ts:1140

The shielded address

***

### amount

> **amount**: `number`

Defined in: packages/types/dist/index.d.ts:1142

Value in ZEC

***

### memo

> **memo**: `string`

Defined in: packages/types/dist/index.d.ts:1144

Memo field (hex)

***

### memoStr?

> `optional` **memoStr**: `string`

Defined in: packages/types/dist/index.d.ts:1146

Memo as UTF-8 if valid

***

### change

> **change**: `boolean`

Defined in: packages/types/dist/index.d.ts:1148

Whether this is change

***

### jsindex?

> `optional` **jsindex**: `number`

Defined in: packages/types/dist/index.d.ts:1150

Sprout: joinsplit index

***

### jsoutindex?

> `optional` **jsoutindex**: `number`

Defined in: packages/types/dist/index.d.ts:1152

Sprout: joinsplit output index
