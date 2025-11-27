[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashOperation

# Interface: ZcashOperation

Defined in: packages/types/dist/index.d.ts:1177

Operation status response

## Properties

### id

> **id**: `string`

Defined in: packages/types/dist/index.d.ts:1179

Operation ID

***

### status

> **status**: [`ZcashOperationStatus`](../type-aliases/ZcashOperationStatus.md)

Defined in: packages/types/dist/index.d.ts:1181

Current status

***

### creation\_time

> **creation\_time**: `number`

Defined in: packages/types/dist/index.d.ts:1183

Creation time (Unix timestamp)

***

### method

> **method**: `string`

Defined in: packages/types/dist/index.d.ts:1185

Method that created this operation

***

### params

> **params**: `Record`\<`string`, `unknown`\>

Defined in: packages/types/dist/index.d.ts:1187

Method parameters

***

### result?

> `optional` **result**: [`ZcashOperationTxResult`](ZcashOperationTxResult.md)

Defined in: packages/types/dist/index.d.ts:1189

Result (if successful)

***

### error?

> `optional` **error**: [`ZcashOperationError`](ZcashOperationError.md)

Defined in: packages/types/dist/index.d.ts:1191

Error (if failed)

***

### execution\_secs?

> `optional` **execution\_secs**: `number`

Defined in: packages/types/dist/index.d.ts:1193

Execution seconds (if completed)
