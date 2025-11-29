[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ReportData

# Interface: ReportData

Defined in: packages/types/dist/index.d.ts:2027

Report data structure

## Properties

### summary

> **summary**: `object`

Defined in: packages/types/dist/index.d.ts:2029

Summary statistics

#### totalTransactions

> **totalTransactions**: `number`

#### totalInbound

> **totalInbound**: `number`

#### totalOutbound

> **totalOutbound**: `number`

#### totalVolume

> **totalVolume**: `Record`\<`string`, `bigint`\>

#### uniqueCounterparties

> **uniqueCounterparties**: `number`

#### averageTransactionSize

> **averageTransactionSize**: `Record`\<`string`, `bigint`\>

#### dateRange

> **dateRange**: `object`

##### dateRange.start

> **start**: `number`

##### dateRange.end

> **end**: `number`

***

### byType

> **byType**: `object`

Defined in: packages/types/dist/index.d.ts:2042

Transaction breakdown by type

#### payments

> **payments**: `number`

#### swaps

> **swaps**: `number`

#### deposits

> **deposits**: `number`

#### withdrawals

> **withdrawals**: `number`

***

### byChain

> **byChain**: `Record`\<[`ChainId`](../type-aliases/ChainId.md), `number`\>

Defined in: packages/types/dist/index.d.ts:2049

Transaction breakdown by chain

***

### byPrivacyLevel

> **byPrivacyLevel**: `Record`\<[`PrivacyLevel`](../enumerations/PrivacyLevel.md), `number`\>

Defined in: packages/types/dist/index.d.ts:2051

Transaction breakdown by privacy level

***

### highValueTransactions

> **highValueTransactions**: [`DisclosedTransaction`](DisclosedTransaction.md)[]

Defined in: packages/types/dist/index.d.ts:2053

High-value transactions

***

### riskSummary?

> `optional` **riskSummary**: `object`

Defined in: packages/types/dist/index.d.ts:2055

Risk summary

#### lowRisk

> **lowRisk**: `number`

#### mediumRisk

> **mediumRisk**: `number`

#### highRisk

> **highRisk**: `number`

#### flaggedTransactions

> **flaggedTransactions**: `number`

***

### transactions?

> `optional` **transactions**: [`DisclosedTransaction`](DisclosedTransaction.md)[]

Defined in: packages/types/dist/index.d.ts:2062

Full transaction list (optional)
