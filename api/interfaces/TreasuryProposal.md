[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / TreasuryProposal

# Interface: TreasuryProposal

Defined in: packages/types/dist/index.d.ts:1672

Treasury proposal - a pending action requiring multi-sig approval

## Properties

### proposalId

> **proposalId**: `string`

Defined in: packages/types/dist/index.d.ts:1674

Unique proposal identifier

***

### treasuryId

> **treasuryId**: `string`

Defined in: packages/types/dist/index.d.ts:1676

Treasury this proposal belongs to

***

### type

> **type**: [`ProposalType`](../type-aliases/ProposalType.md)

Defined in: packages/types/dist/index.d.ts:1678

Type of proposal

***

### status

> **status**: [`ProposalStatusType`](../type-aliases/ProposalStatusType.md)

Defined in: packages/types/dist/index.d.ts:1680

Current status

***

### proposer

> **proposer**: `string`

Defined in: packages/types/dist/index.d.ts:1682

Who created the proposal

***

### title

> **title**: `string`

Defined in: packages/types/dist/index.d.ts:1684

Title/summary

***

### description?

> `optional` **description**: `string`

Defined in: packages/types/dist/index.d.ts:1686

Detailed description

***

### createdAt

> **createdAt**: `number`

Defined in: packages/types/dist/index.d.ts:1688

Creation timestamp

***

### expiresAt

> **expiresAt**: `number`

Defined in: packages/types/dist/index.d.ts:1690

Expiration timestamp

***

### requiredSignatures

> **requiredSignatures**: `number`

Defined in: packages/types/dist/index.d.ts:1692

Required signatures

***

### signatures

> **signatures**: [`ProposalSignature`](ProposalSignature.md)[]

Defined in: packages/types/dist/index.d.ts:1694

Collected signatures

***

### payment?

> `optional` **payment**: `object`

Defined in: packages/types/dist/index.d.ts:1696

Single payment data

#### recipient

> **recipient**: `string`

#### token

> **token**: [`Asset`](Asset.md)

#### amount

> **amount**: `bigint`

#### memo?

> `optional` **memo**: `string`

#### purpose?

> `optional` **purpose**: [`PaymentPurpose`](../type-aliases/PaymentPurpose.md)

#### privacy

> **privacy**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

***

### batchPayment?

> `optional` **batchPayment**: [`BatchPaymentRequest`](BatchPaymentRequest.md)

Defined in: packages/types/dist/index.d.ts:1705

Batch payment data

***

### configChange?

> `optional` **configChange**: `object`

Defined in: packages/types/dist/index.d.ts:1707

Configuration changes

#### field

> **field**: keyof [`TreasuryConfig`](TreasuryConfig.md)

#### oldValue

> **oldValue**: `unknown`

#### newValue

> **newValue**: `unknown`

***

### memberChange?

> `optional` **memberChange**: `object`

Defined in: packages/types/dist/index.d.ts:1713

Member to add/remove

#### action

> **action**: `"add"` \| `"remove"`

#### member

> **member**: [`TreasuryMember`](TreasuryMember.md)

***

### executedAt?

> `optional` **executedAt**: `number`

Defined in: packages/types/dist/index.d.ts:1718

Execution timestamp

***

### transactionHashes?

> `optional` **transactionHashes**: `string`[]

Defined in: packages/types/dist/index.d.ts:1720

Transaction hash(es) from execution

***

### resultPayments?

> `optional` **resultPayments**: [`ShieldedPayment`](ShieldedPayment.md)[]

Defined in: packages/types/dist/index.d.ts:1722

Resulting payments (for payment proposals)
