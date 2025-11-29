[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / TreasuryTransaction

# Interface: TreasuryTransaction

Defined in: packages/types/dist/index.d.ts:1742

Treasury transaction record

## Properties

### transactionId

> **transactionId**: `string`

Defined in: packages/types/dist/index.d.ts:1744

Transaction ID

***

### treasuryId

> **treasuryId**: `string`

Defined in: packages/types/dist/index.d.ts:1746

Treasury ID

***

### proposalId?

> `optional` **proposalId**: `string`

Defined in: packages/types/dist/index.d.ts:1748

Related proposal ID

***

### direction

> **direction**: `"inbound"` \| `"outbound"`

Defined in: packages/types/dist/index.d.ts:1750

Type: inbound or outbound

***

### token

> **token**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:1752

Token

***

### amount

> **amount**: `bigint`

Defined in: packages/types/dist/index.d.ts:1754

Amount

***

### counterparty

> **counterparty**: `string`

Defined in: packages/types/dist/index.d.ts:1756

Counterparty address

***

### txHash

> **txHash**: `string`

Defined in: packages/types/dist/index.d.ts:1758

Transaction hash

***

### blockNumber

> **blockNumber**: `number`

Defined in: packages/types/dist/index.d.ts:1760

Block number

***

### timestamp

> **timestamp**: `number`

Defined in: packages/types/dist/index.d.ts:1762

Timestamp

***

### privacy

> **privacy**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:1764

Privacy level used

***

### memo?

> `optional` **memo**: `string`

Defined in: packages/types/dist/index.d.ts:1766

Memo/reference
