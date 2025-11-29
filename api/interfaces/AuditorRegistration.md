[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / AuditorRegistration

# Interface: AuditorRegistration

Defined in: packages/types/dist/index.d.ts:1888

Auditor registration

## Properties

### auditorId

> **auditorId**: `string`

Defined in: packages/types/dist/index.d.ts:1890

Unique auditor ID

***

### organization

> **organization**: `string`

Defined in: packages/types/dist/index.d.ts:1892

Auditor's organization name

***

### contactName

> **contactName**: `string`

Defined in: packages/types/dist/index.d.ts:1894

Contact name

***

### contactEmail

> **contactEmail**: `string`

Defined in: packages/types/dist/index.d.ts:1896

Contact email

***

### publicKey

> **publicKey**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:1898

Auditor's public key for secure communication

***

### viewingKey?

> `optional` **viewingKey**: [`ViewingKey`](ViewingKey.md)

Defined in: packages/types/dist/index.d.ts:1900

Assigned viewing key

***

### scope

> **scope**: [`AuditScope`](AuditScope.md)

Defined in: packages/types/dist/index.d.ts:1902

Audit scope

***

### role

> **role**: [`ComplianceRole`](../type-aliases/ComplianceRole.md)

Defined in: packages/types/dist/index.d.ts:1904

Role

***

### registeredAt

> **registeredAt**: `number`

Defined in: packages/types/dist/index.d.ts:1906

Registration timestamp

***

### registeredBy

> **registeredBy**: `string`

Defined in: packages/types/dist/index.d.ts:1908

Registered by (admin address)

***

### isActive

> **isActive**: `boolean`

Defined in: packages/types/dist/index.d.ts:1910

Active status

***

### deactivatedAt?

> `optional` **deactivatedAt**: `number`

Defined in: packages/types/dist/index.d.ts:1912

Deactivation timestamp

***

### deactivationReason?

> `optional` **deactivationReason**: `string`

Defined in: packages/types/dist/index.d.ts:1914

Deactivation reason
