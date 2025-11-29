[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ComplianceReport

# Interface: ComplianceReport

Defined in: packages/types/dist/index.d.ts:1986

Compliance report

## Properties

### reportId

> **reportId**: `string`

Defined in: packages/types/dist/index.d.ts:1988

Report ID

***

### type

> **type**: [`ReportType`](../type-aliases/ReportType.md)

Defined in: packages/types/dist/index.d.ts:1990

Report type

***

### title

> **title**: `string`

Defined in: packages/types/dist/index.d.ts:1992

Report title

***

### description?

> `optional` **description**: `string`

Defined in: packages/types/dist/index.d.ts:1994

Description

***

### format

> **format**: [`ReportFormat`](../type-aliases/ReportFormat.md)

Defined in: packages/types/dist/index.d.ts:1996

Report format

***

### status

> **status**: [`ReportStatusType`](../type-aliases/ReportStatusType.md)

Defined in: packages/types/dist/index.d.ts:1998

Status

***

### generatedAt?

> `optional` **generatedAt**: `number`

Defined in: packages/types/dist/index.d.ts:2000

Generation timestamp

***

### requestedBy

> **requestedBy**: `string`

Defined in: packages/types/dist/index.d.ts:2002

Requested by

***

### requestedAt

> **requestedAt**: `number`

Defined in: packages/types/dist/index.d.ts:2004

Request timestamp

***

### startDate

> **startDate**: `number`

Defined in: packages/types/dist/index.d.ts:2006

Start date

***

### endDate

> **endDate**: `number`

Defined in: packages/types/dist/index.d.ts:2008

End date

***

### chains

> **chains**: [`ChainId`](../type-aliases/ChainId.md)[]

Defined in: packages/types/dist/index.d.ts:2010

Chains included

***

### tokens

> **tokens**: `string`[]

Defined in: packages/types/dist/index.d.ts:2012

Tokens included

***

### includeInbound

> **includeInbound**: `boolean`

Defined in: packages/types/dist/index.d.ts:2014

Include inbound transactions

***

### includeOutbound

> **includeOutbound**: `boolean`

Defined in: packages/types/dist/index.d.ts:2016

Include outbound transactions

***

### data?

> `optional` **data**: [`ReportData`](ReportData.md)

Defined in: packages/types/dist/index.d.ts:2018

Report data (for JSON format)

***

### content?

> `optional` **content**: `string`

Defined in: packages/types/dist/index.d.ts:2020

Report content (for CSV/PDF - base64 encoded)

***

### error?

> `optional` **error**: `string`

Defined in: packages/types/dist/index.d.ts:2022

Error message (if failed)
