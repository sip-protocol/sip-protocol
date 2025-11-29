[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashBlock

# Interface: ZcashBlock

Defined in: packages/types/dist/index.d.ts:1261

Full block data

## Extends

- [`ZcashBlockHeader`](ZcashBlockHeader.md)

## Properties

### hash

> **hash**: `string`

Defined in: packages/types/dist/index.d.ts:1232

Block hash

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`hash`](ZcashBlockHeader.md#hash)

***

### confirmations

> **confirmations**: `number`

Defined in: packages/types/dist/index.d.ts:1234

Number of confirmations

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`confirmations`](ZcashBlockHeader.md#confirmations)

***

### height

> **height**: `number`

Defined in: packages/types/dist/index.d.ts:1236

Block height

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`height`](ZcashBlockHeader.md#height)

***

### version

> **version**: `number`

Defined in: packages/types/dist/index.d.ts:1238

Block version

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`version`](ZcashBlockHeader.md#version)

***

### merkleroot

> **merkleroot**: `string`

Defined in: packages/types/dist/index.d.ts:1240

Merkle root

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`merkleroot`](ZcashBlockHeader.md#merkleroot)

***

### time

> **time**: `number`

Defined in: packages/types/dist/index.d.ts:1242

Block time (Unix timestamp)

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`time`](ZcashBlockHeader.md#time)

***

### nonce

> **nonce**: `string`

Defined in: packages/types/dist/index.d.ts:1244

Nonce

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`nonce`](ZcashBlockHeader.md#nonce)

***

### solution

> **solution**: `string`

Defined in: packages/types/dist/index.d.ts:1246

Solution

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`solution`](ZcashBlockHeader.md#solution)

***

### bits

> **bits**: `string`

Defined in: packages/types/dist/index.d.ts:1248

Bits

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`bits`](ZcashBlockHeader.md#bits)

***

### difficulty

> **difficulty**: `number`

Defined in: packages/types/dist/index.d.ts:1250

Difficulty

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`difficulty`](ZcashBlockHeader.md#difficulty)

***

### chainwork

> **chainwork**: `string`

Defined in: packages/types/dist/index.d.ts:1252

Chain work

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`chainwork`](ZcashBlockHeader.md#chainwork)

***

### previousblockhash?

> `optional` **previousblockhash**: `string`

Defined in: packages/types/dist/index.d.ts:1254

Previous block hash

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`previousblockhash`](ZcashBlockHeader.md#previousblockhash)

***

### nextblockhash?

> `optional` **nextblockhash**: `string`

Defined in: packages/types/dist/index.d.ts:1256

Next block hash

#### Inherited from

[`ZcashBlockHeader`](ZcashBlockHeader.md).[`nextblockhash`](ZcashBlockHeader.md#nextblockhash)

***

### tx

> **tx**: `string`[]

Defined in: packages/types/dist/index.d.ts:1263

Transaction IDs in the block

***

### size

> **size**: `number`

Defined in: packages/types/dist/index.d.ts:1265

Block size in bytes
