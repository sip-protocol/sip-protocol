[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / CreateTreasuryParams

# Interface: CreateTreasuryParams

Defined in: packages/types/dist/index.d.ts:1771

Parameters for creating a treasury

## Properties

### name

> **name**: `string`

Defined in: packages/types/dist/index.d.ts:1773

Treasury name

***

### description?

> `optional` **description**: `string`

Defined in: packages/types/dist/index.d.ts:1775

Description

***

### chain

> **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:1777

Primary chain

***

### members

> **members**: `Omit`\<[`TreasuryMember`](TreasuryMember.md), `"addedAt"` \| `"addedBy"`\>[]

Defined in: packages/types/dist/index.d.ts:1779

Initial members (must include at least one owner)

***

### signingThreshold

> **signingThreshold**: `number`

Defined in: packages/types/dist/index.d.ts:1781

Signing threshold

***

### defaultPrivacy?

> `optional` **defaultPrivacy**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:1783

Default privacy level

***

### dailyLimit?

> `optional` **dailyLimit**: `bigint`

Defined in: packages/types/dist/index.d.ts:1785

Daily spending limit

***

### transactionLimit?

> `optional` **transactionLimit**: `bigint`

Defined in: packages/types/dist/index.d.ts:1787

Per-transaction limit
