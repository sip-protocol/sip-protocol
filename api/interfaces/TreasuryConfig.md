[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / TreasuryConfig

# Interface: TreasuryConfig

Defined in: packages/types/dist/index.d.ts:1600

Treasury configuration

## Properties

### treasuryId

> **treasuryId**: `string`

Defined in: packages/types/dist/index.d.ts:1602

Unique treasury identifier

***

### name

> **name**: `string`

Defined in: packages/types/dist/index.d.ts:1604

Human-readable name

***

### description?

> `optional` **description**: `string`

Defined in: packages/types/dist/index.d.ts:1606

Description

***

### chain

> **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:1608

Primary chain for the treasury

***

### signingThreshold

> **signingThreshold**: `number`

Defined in: packages/types/dist/index.d.ts:1610

Number of signatures required for spending

***

### totalSigners

> **totalSigners**: `number`

Defined in: packages/types/dist/index.d.ts:1612

Total number of signers

***

### members

> **members**: [`TreasuryMember`](TreasuryMember.md)[]

Defined in: packages/types/dist/index.d.ts:1614

List of treasury members

***

### defaultPrivacy

> **defaultPrivacy**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:1616

Default privacy level for transactions

***

### masterViewingKey?

> `optional` **masterViewingKey**: [`ViewingKey`](ViewingKey.md)

Defined in: packages/types/dist/index.d.ts:1618

Master viewing key for the treasury

***

### dailyLimit?

> `optional` **dailyLimit**: `bigint`

Defined in: packages/types/dist/index.d.ts:1620

Daily spending limit (in USD equivalent)

***

### transactionLimit?

> `optional` **transactionLimit**: `bigint`

Defined in: packages/types/dist/index.d.ts:1622

Per-transaction limit

***

### createdAt

> **createdAt**: `number`

Defined in: packages/types/dist/index.d.ts:1624

Creation timestamp

***

### updatedAt

> **updatedAt**: `number`

Defined in: packages/types/dist/index.d.ts:1626

Last updated timestamp
