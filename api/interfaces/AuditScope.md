[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / AuditScope

# Interface: AuditScope

Defined in: packages/types/dist/index.d.ts:1869

Audit scope - what an auditor can access

## Properties

### transactionTypes

> **transactionTypes**: (`"all"` \| `"inbound"` \| `"outbound"`)[]

Defined in: packages/types/dist/index.d.ts:1871

Transaction types: all, inbound, outbound

***

### chains

> **chains**: [`ChainId`](../type-aliases/ChainId.md)[]

Defined in: packages/types/dist/index.d.ts:1873

Specific chains to audit (empty = all)

***

### tokens

> **tokens**: `string`[]

Defined in: packages/types/dist/index.d.ts:1875

Specific tokens to audit (empty = all)

***

### startDate

> **startDate**: `number`

Defined in: packages/types/dist/index.d.ts:1877

Start date for audit period

***

### endDate?

> `optional` **endDate**: `number`

Defined in: packages/types/dist/index.d.ts:1879

End date for audit period (optional, ongoing if not set)

***

### minAmount?

> `optional` **minAmount**: `bigint`

Defined in: packages/types/dist/index.d.ts:1881

Minimum transaction amount to include

***

### maxAmount?

> `optional` **maxAmount**: `bigint`

Defined in: packages/types/dist/index.d.ts:1883

Maximum transaction amount to include
