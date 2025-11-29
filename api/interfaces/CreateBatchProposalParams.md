[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / CreateBatchProposalParams

# Interface: CreateBatchProposalParams

Defined in: packages/types/dist/index.d.ts:1817

Parameters for creating a batch payment proposal

## Properties

### treasuryId

> **treasuryId**: `string`

Defined in: packages/types/dist/index.d.ts:1819

Treasury ID

***

### title

> **title**: `string`

Defined in: packages/types/dist/index.d.ts:1821

Proposal title

***

### description?

> `optional` **description**: `string`

Defined in: packages/types/dist/index.d.ts:1823

Description

***

### token

> **token**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:1825

Token to send

***

### recipients

> **recipients**: [`BatchPaymentRecipient`](BatchPaymentRecipient.md)[]

Defined in: packages/types/dist/index.d.ts:1827

Recipients

***

### privacy?

> `optional` **privacy**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:1829

Privacy level

***

### ttl?

> `optional` **ttl**: `number`

Defined in: packages/types/dist/index.d.ts:1831

Expiration (seconds from now, default: 7 days)
