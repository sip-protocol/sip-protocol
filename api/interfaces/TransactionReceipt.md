[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / TransactionReceipt

# Interface: TransactionReceipt

Defined in: packages/types/dist/index.d.ts:2238

Transaction receipt after broadcast

## Properties

### txHash

> **txHash**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:2240

Transaction hash

***

### blockNumber?

> `optional` **blockNumber**: `bigint`

Defined in: packages/types/dist/index.d.ts:2242

Block number (if confirmed)

***

### blockHash?

> `optional` **blockHash**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:2244

Block hash (if confirmed)

***

### status

> **status**: `"pending"` \| `"failed"` \| `"confirmed"`

Defined in: packages/types/dist/index.d.ts:2246

Transaction status

***

### feeUsed?

> `optional` **feeUsed**: `bigint`

Defined in: packages/types/dist/index.d.ts:2248

Gas/fee used

***

### timestamp?

> `optional` **timestamp**: `number`

Defined in: packages/types/dist/index.d.ts:2250

Timestamp
