[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / AuditorViewingKey

# Interface: AuditorViewingKey

Defined in: packages/types/dist/index.d.ts:1836

Auditor viewing key - derived from treasury master key

## Properties

### auditorId

> **auditorId**: `string`

Defined in: packages/types/dist/index.d.ts:1838

Auditor identifier

***

### name

> **name**: `string`

Defined in: packages/types/dist/index.d.ts:1840

Auditor name

***

### viewingKey

> **viewingKey**: [`ViewingKey`](ViewingKey.md)

Defined in: packages/types/dist/index.d.ts:1842

The derived viewing key

***

### scope

> **scope**: `"all"` \| `"inbound"` \| `"outbound"`

Defined in: packages/types/dist/index.d.ts:1844

Scope of access

***

### validFrom

> **validFrom**: `number`

Defined in: packages/types/dist/index.d.ts:1846

Start date for access

***

### validUntil?

> `optional` **validUntil**: `number`

Defined in: packages/types/dist/index.d.ts:1848

End date for access (optional)

***

### grantedBy

> **grantedBy**: `string`

Defined in: packages/types/dist/index.d.ts:1850

Who granted this key

***

### grantedAt

> **grantedAt**: `number`

Defined in: packages/types/dist/index.d.ts:1852

When granted
