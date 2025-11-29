[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / AuditLogEntry

# Interface: AuditLogEntry

Defined in: packages/types/dist/index.d.ts:2176

Audit log entry

## Properties

### entryId

> **entryId**: `string`

Defined in: packages/types/dist/index.d.ts:2178

Entry ID

***

### timestamp

> **timestamp**: `number`

Defined in: packages/types/dist/index.d.ts:2180

Timestamp

***

### actor

> **actor**: `string`

Defined in: packages/types/dist/index.d.ts:2182

Actor (who performed the action)

***

### action

> **action**: `"auditor_registered"` \| `"auditor_deactivated"` \| `"transaction_disclosed"` \| `"report_generated"` \| `"disclosure_requested"` \| `"disclosure_approved"` \| `"disclosure_denied"` \| `"config_updated"`

Defined in: packages/types/dist/index.d.ts:2184

Action type

***

### details

> **details**: `Record`\<`string`, `unknown`\>

Defined in: packages/types/dist/index.d.ts:2186

Action details

***

### ipAddress?

> `optional` **ipAddress**: `string`

Defined in: packages/types/dist/index.d.ts:2188

IP address (if available)
