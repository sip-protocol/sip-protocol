[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashBlock

# Interface: ZcashBlock

Defined in: packages/types/dist/index.d.ts:1229

Full block data

## Extends

- [`ZcashBlockHeader`](ZcashBlockHeader.md)

## Properties

### hash

> **hash**: `string`

Defined in: packages/types/dist/index.d.ts:1200

Block hash

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`hash`](ZcashBlockHeader.md#hash)

***

### confirmations

> **confirmations**: `number`

Defined in: packages/types/dist/index.d.ts:1202

Number of confirmations

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`confirmations`](ZcashBlockHeader.md#confirmations)

***

### height

> **height**: `number`

Defined in: packages/types/dist/index.d.ts:1204

Block height

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`height`](ZcashBlockHeader.md#height)

***

### version

> **version**: `number`

Defined in: packages/types/dist/index.d.ts:1206

Block version

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`version`](ZcashBlockHeader.md#version)

***

### merkleroot

> **merkleroot**: `string`

Defined in: packages/types/dist/index.d.ts:1208

Merkle root

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`merkleroot`](ZcashBlockHeader.md#merkleroot)

***

### time

> **time**: `number`

Defined in: packages/types/dist/index.d.ts:1210

Block time (Unix timestamp)

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`time`](ZcashBlockHeader.md#time)

***

### nonce

> **nonce**: `string`

Defined in: packages/types/dist/index.d.ts:1212

Nonce

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`nonce`](ZcashBlockHeader.md#nonce)

***

### solution

> **solution**: `string`

Defined in: packages/types/dist/index.d.ts:1214

Solution

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`solution`](ZcashBlockHeader.md#solution)

***

### bits

> **bits**: `string`

Defined in: packages/types/dist/index.d.ts:1216

Bits

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`bits`](ZcashBlockHeader.md#bits)

***

### difficulty

> **difficulty**: `number`

Defined in: packages/types/dist/index.d.ts:1218

Difficulty

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`difficulty`](ZcashBlockHeader.md#difficulty)

***

### chainwork

> **chainwork**: `string`

Defined in: packages/types/dist/index.d.ts:1220

Chain work

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`chainwork`](ZcashBlockHeader.md#chainwork)

***

### previousblockhash?

> `optional` **previousblockhash**: `string`

Defined in: packages/types/dist/index.d.ts:1222

Previous block hash

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`previousblockhash`](ZcashBlockHeader.md#previousblockhash)

***

### nextblockhash?

> `optional` **nextblockhash**: `string`

Defined in: packages/types/dist/index.d.ts:1224

Next block hash

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`nextblockhash`](ZcashBlockHeader.md#nextblockhash)

***

### tx

> **tx**: `string`[]

Defined in: packages/types/dist/index.d.ts:1231

Transaction IDs in the block

***

### size

> **size**: `number`

Defined in: packages/types/dist/index.d.ts:1233

Block size in bytes
