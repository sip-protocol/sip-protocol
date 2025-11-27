[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashBlockchainInfo

# Interface: ZcashBlockchainInfo

Defined in: packages/types/dist/index.d.ts:1305

Blockchain information

## Properties

### chain

> **chain**: `string`

Defined in: packages/types/dist/index.d.ts:1307

Current network (main, test, regtest)

***

### blocks

> **blocks**: `number`

Defined in: packages/types/dist/index.d.ts:1309

Current block count

***

### headers

> **headers**: `number`

Defined in: packages/types/dist/index.d.ts:1311

Current header count

***

### bestblockhash

> **bestblockhash**: `string`

Defined in: packages/types/dist/index.d.ts:1313

Best block hash

***

### difficulty

> **difficulty**: `number`

Defined in: packages/types/dist/index.d.ts:1315

Current difficulty

***

### verificationprogress

> **verificationprogress**: `number`

Defined in: packages/types/dist/index.d.ts:1317

Verification progress

***

### chainwork

> **chainwork**: `string`

Defined in: packages/types/dist/index.d.ts:1319

Chain work

***

### initialblockdownload

> **initialblockdownload**: `boolean`

Defined in: packages/types/dist/index.d.ts:1321

Whether initial block download is complete

***

### size\_on\_disk

> **size\_on\_disk**: `number`

Defined in: packages/types/dist/index.d.ts:1323

Size on disk in bytes

***

### pruned

> **pruned**: `boolean`

Defined in: packages/types/dist/index.d.ts:1325

Whether pruned

***

### consensus

> **consensus**: `object`

Defined in: packages/types/dist/index.d.ts:1327

Consensus parameters

#### chaintip

> **chaintip**: `string`

#### nextblock

> **nextblock**: `string`
