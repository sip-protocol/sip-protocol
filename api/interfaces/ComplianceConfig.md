[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ComplianceConfig

# Interface: ComplianceConfig

Defined in: packages/types/dist/index.d.ts:2067

Compliance configuration

## Properties

### organizationId

> **organizationId**: `string`

Defined in: packages/types/dist/index.d.ts:2069

Organization ID

***

### organizationName

> **organizationName**: `string`

Defined in: packages/types/dist/index.d.ts:2071

Organization name

***

### masterViewingKey

> **masterViewingKey**: [`ViewingKey`](ViewingKey.md)

Defined in: packages/types/dist/index.d.ts:2073

Master viewing key for the organization

***

### defaultAuditScope

> **defaultAuditScope**: `Partial`\<[`AuditScope`](AuditScope.md)\>

Defined in: packages/types/dist/index.d.ts:2075

Default audit scope for new auditors

***

### riskThreshold

> **riskThreshold**: `number`

Defined in: packages/types/dist/index.d.ts:2077

Risk threshold for flagging transactions

***

### highValueThreshold

> **highValueThreshold**: `bigint`

Defined in: packages/types/dist/index.d.ts:2079

High-value transaction threshold (in USD equivalent)

***

### retentionPeriodDays

> **retentionPeriodDays**: `number`

Defined in: packages/types/dist/index.d.ts:2081

Retention period for disclosed transactions (days)

***

### autoReporting

> **autoReporting**: `object`

Defined in: packages/types/dist/index.d.ts:2083

Auto-generate reports

#### enabled

> **enabled**: `boolean`

#### frequency

> **frequency**: `"monthly"` \| `"daily"` \| `"weekly"`

#### reportTypes

> **reportTypes**: [`ReportType`](../type-aliases/ReportType.md)[]

***

### createdAt

> **createdAt**: `number`

Defined in: packages/types/dist/index.d.ts:2089

Created timestamp

***

### updatedAt

> **updatedAt**: `number`

Defined in: packages/types/dist/index.d.ts:2091

Updated timestamp
