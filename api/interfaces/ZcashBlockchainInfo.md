[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashBlockchainInfo

# Interface: ZcashBlockchainInfo

Defined in: packages/types/dist/index.d.ts:1337

Blockchain information

## Properties

### chain

> **chain**: `string`

Defined in: packages/types/dist/index.d.ts:1339

Current network (main, test, regtest)

***

### blocks

> **blocks**: `number`

Defined in: packages/types/dist/index.d.ts:1341

Current block count

***

### headers

> **headers**: `number`

Defined in: packages/types/dist/index.d.ts:1343

Current header count

***

### bestblockhash

> **bestblockhash**: `string`

Defined in: packages/types/dist/index.d.ts:1345

Best block hash

***

### difficulty

> **difficulty**: `number`

Defined in: packages/types/dist/index.d.ts:1347

Current difficulty

***

### verificationprogress

> **verificationprogress**: `number`

Defined in: packages/types/dist/index.d.ts:1349

Verification progress

***

### chainwork

> **chainwork**: `string`

Defined in: packages/types/dist/index.d.ts:1351

Chain work

***

### initialblockdownload

> **initialblockdownload**: `boolean`

Defined in: packages/types/dist/index.d.ts:1353

Whether initial block download is complete

***

### size\_on\_disk

> **size\_on\_disk**: `number`

Defined in: packages/types/dist/index.d.ts:1355

Size on disk in bytes

***

### pruned

> **pruned**: `boolean`

Defined in: packages/types/dist/index.d.ts:1357

Whether pruned

***

### consensus

> **consensus**: `object`

Defined in: packages/types/dist/index.d.ts:1359

Consensus parameters

#### chaintip

> **chaintip**: `string`

#### nextblock

> **nextblock**: `string`
