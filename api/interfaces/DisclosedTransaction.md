[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / DisclosedTransaction

# Interface: DisclosedTransaction

Defined in: packages/types/dist/index.d.ts:1919

Disclosed transaction - a transaction revealed to an auditor

## Properties

### transactionId

> **transactionId**: `string`

Defined in: packages/types/dist/index.d.ts:1921

Original payment/transaction ID

***

### disclosureId

> **disclosureId**: `string`

Defined in: packages/types/dist/index.d.ts:1923

Disclosure ID

***

### auditorId

> **auditorId**: `string`

Defined in: packages/types/dist/index.d.ts:1925

Auditor ID who received disclosure

***

### disclosedAt

> **disclosedAt**: `number`

Defined in: packages/types/dist/index.d.ts:1927

Disclosure timestamp

***

### disclosedBy

> **disclosedBy**: `string`

Defined in: packages/types/dist/index.d.ts:1929

Who authorized the disclosure

***

### type

> **type**: `"payment"` \| `"swap"` \| `"deposit"` \| `"withdrawal"`

Defined in: packages/types/dist/index.d.ts:1931

Transaction type

***

### direction

> **direction**: `"inbound"` \| `"outbound"`

Defined in: packages/types/dist/index.d.ts:1933

Direction

***

### token

> **token**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:1935

Token

***

### amount

> **amount**: `bigint`

Defined in: packages/types/dist/index.d.ts:1937

Amount

***

### sender

> **sender**: `string`

Defined in: packages/types/dist/index.d.ts:1939

Sender address (may be stealth)

***

### recipient

> **recipient**: `string`

Defined in: packages/types/dist/index.d.ts:1941

Recipient address (may be stealth)

***

### txHash

> **txHash**: `string`

Defined in: packages/types/dist/index.d.ts:1943

Transaction hash

***

### blockNumber

> **blockNumber**: `number`

Defined in: packages/types/dist/index.d.ts:1945

Block number

***

### timestamp

> **timestamp**: `number`

Defined in: packages/types/dist/index.d.ts:1947

Transaction timestamp

***

### chain

> **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:1949

Chain

***

### privacyLevel

> **privacyLevel**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:1951

Privacy level used

***

### memo?

> `optional` **memo**: `string`

Defined in: packages/types/dist/index.d.ts:1953

Memo/reference

***

### purpose?

> `optional` **purpose**: [`PaymentPurpose`](../type-aliases/PaymentPurpose.md)

Defined in: packages/types/dist/index.d.ts:1955

Purpose

***

### riskScore?

> `optional` **riskScore**: `number`

Defined in: packages/types/dist/index.d.ts:1957

Risk score (0-100)

***

### riskFlags?

> `optional` **riskFlags**: `string`[]

Defined in: packages/types/dist/index.d.ts:1959

Risk flags

***

### notes?

> `optional` **notes**: `string`

Defined in: packages/types/dist/index.d.ts:1961

Compliance notes

***

### tags?

> `optional` **tags**: `string`[]

Defined in: packages/types/dist/index.d.ts:1963

Tags for categorization
