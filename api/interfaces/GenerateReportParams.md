[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / GenerateReportParams

# Interface: GenerateReportParams

Defined in: packages/types/dist/index.d.ts:2126

Parameters for generating a report

## Properties

### type

> **type**: [`ReportType`](../type-aliases/ReportType.md)

Defined in: packages/types/dist/index.d.ts:2128

Report type

***

### title

> **title**: `string`

Defined in: packages/types/dist/index.d.ts:2130

Report title

***

### description?

> `optional` **description**: `string`

Defined in: packages/types/dist/index.d.ts:2132

Description

***

### format

> **format**: [`ReportFormat`](../type-aliases/ReportFormat.md)

Defined in: packages/types/dist/index.d.ts:2134

Format

***

### startDate

> **startDate**: `number`

Defined in: packages/types/dist/index.d.ts:2136

Start date

***

### endDate

> **endDate**: `number`

Defined in: packages/types/dist/index.d.ts:2138

End date

***

### chains?

> `optional` **chains**: [`ChainId`](../type-aliases/ChainId.md)[]

Defined in: packages/types/dist/index.d.ts:2140

Chains to include

***

### tokens?

> `optional` **tokens**: `string`[]

Defined in: packages/types/dist/index.d.ts:2142

Tokens to include

***

### includeInbound?

> `optional` **includeInbound**: `boolean`

Defined in: packages/types/dist/index.d.ts:2144

Include inbound

***

### includeOutbound?

> `optional` **includeOutbound**: `boolean`

Defined in: packages/types/dist/index.d.ts:2146

Include outbound

***

### includeTransactions?

> `optional` **includeTransactions**: `boolean`

Defined in: packages/types/dist/index.d.ts:2148

Include full transaction list
