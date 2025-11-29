[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / CreatePaymentProposalParams

# Interface: CreatePaymentProposalParams

Defined in: packages/types/dist/index.d.ts:1792

Parameters for creating a payment proposal

## Properties

### treasuryId

> **treasuryId**: `string`

Defined in: packages/types/dist/index.d.ts:1794

Treasury ID

***

### title

> **title**: `string`

Defined in: packages/types/dist/index.d.ts:1796

Proposal title

***

### description?

> `optional` **description**: `string`

Defined in: packages/types/dist/index.d.ts:1798

Description

***

### recipient

> **recipient**: `string`

Defined in: packages/types/dist/index.d.ts:1800

Recipient address or stealth meta-address

***

### token

> **token**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:1802

Token to send

***

### amount

> **amount**: `bigint`

Defined in: packages/types/dist/index.d.ts:1804

Amount

***

### memo?

> `optional` **memo**: `string`

Defined in: packages/types/dist/index.d.ts:1806

Memo

***

### purpose?

> `optional` **purpose**: [`PaymentPurpose`](../type-aliases/PaymentPurpose.md)

Defined in: packages/types/dist/index.d.ts:1808

Purpose

***

### privacy?

> `optional` **privacy**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:1810

Privacy level

***

### ttl?

> `optional` **ttl**: `number`

Defined in: packages/types/dist/index.d.ts:1812

Expiration (seconds from now, default: 7 days)
