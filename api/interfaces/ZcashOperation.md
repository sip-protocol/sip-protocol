[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashOperation

# Interface: ZcashOperation

Defined in: packages/types/dist/index.d.ts:1209

Operation status response

## Properties

### id

> **id**: `string`

Defined in: packages/types/dist/index.d.ts:1211

Operation ID

***

### status

> **status**: [`ZcashOperationStatus`](../type-aliases/ZcashOperationStatus.md)

Defined in: packages/types/dist/index.d.ts:1213

Current status

***

### creation\_time

> **creation\_time**: `number`

Defined in: packages/types/dist/index.d.ts:1215

Creation time (Unix timestamp)

***

### method

> **method**: `string`

Defined in: packages/types/dist/index.d.ts:1217

Method that created this operation

***

### params

> **params**: `Record`\<`string`, `unknown`\>

Defined in: packages/types/dist/index.d.ts:1219

Method parameters

***

### result?

> `optional` **result**: [`ZcashOperationTxResult`](ZcashOperationTxResult.md)

Defined in: packages/types/dist/index.d.ts:1221

Result (if successful)

***

### error?

> `optional` **error**: [`ZcashOperationError`](ZcashOperationError.md)

Defined in: packages/types/dist/index.d.ts:1223

Error (if failed)

***

### execution\_secs?

> `optional` **execution\_secs**: `number`

Defined in: packages/types/dist/index.d.ts:1225

Execution seconds (if completed)
