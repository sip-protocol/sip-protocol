[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / DisclosureRequest

# Interface: DisclosureRequest

Defined in: packages/types/dist/index.d.ts:2153

Disclosure request - request to disclose a transaction

## Properties

### requestId

> **requestId**: `string`

Defined in: packages/types/dist/index.d.ts:2155

Request ID

***

### transactionId

> **transactionId**: `string`

Defined in: packages/types/dist/index.d.ts:2157

Transaction ID to disclose

***

### auditorId

> **auditorId**: `string`

Defined in: packages/types/dist/index.d.ts:2159

Auditor requesting disclosure

***

### reason

> **reason**: `string`

Defined in: packages/types/dist/index.d.ts:2161

Reason for request

***

### requestedAt

> **requestedAt**: `number`

Defined in: packages/types/dist/index.d.ts:2163

Request timestamp

***

### status

> **status**: `"pending"` \| `"approved"` \| `"denied"`

Defined in: packages/types/dist/index.d.ts:2165

Status

***

### approvedBy?

> `optional` **approvedBy**: `string`

Defined in: packages/types/dist/index.d.ts:2167

Approver address

***

### resolvedAt?

> `optional` **resolvedAt**: `number`

Defined in: packages/types/dist/index.d.ts:2169

Approval/denial timestamp

***

### denialReason?

> `optional` **denialReason**: `string`

Defined in: packages/types/dist/index.d.ts:2171

Denial reason
