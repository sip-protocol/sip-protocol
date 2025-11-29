[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashAddressInfo

# Interface: ZcashAddressInfo

Defined in: packages/types/dist/index.d.ts:1061

Address validation result

## Properties

### isvalid

> **isvalid**: `boolean`

Defined in: packages/types/dist/index.d.ts:1063

Whether the address is valid

***

### address?

> `optional` **address**: `string`

Defined in: packages/types/dist/index.d.ts:1065

The validated address

***

### address\_type?

> `optional` **address\_type**: [`ZcashAddressType`](../type-aliases/ZcashAddressType.md)

Defined in: packages/types/dist/index.d.ts:1067

Address type

***

### type?

> `optional` **type**: [`ZcashAddressType`](../type-aliases/ZcashAddressType.md)

Defined in: packages/types/dist/index.d.ts:1069

Deprecated: same as address_type

***

### ismine?

> `optional` **ismine**: `boolean`

Defined in: packages/types/dist/index.d.ts:1071

Whether the address belongs to this wallet

***

### payingkey?

> `optional` **payingkey**: `string`

Defined in: packages/types/dist/index.d.ts:1073

Sprout: paying key

***

### transmissionkey?

> `optional` **transmissionkey**: `string`

Defined in: packages/types/dist/index.d.ts:1075

Sprout: transmission key

***

### diversifier?

> `optional` **diversifier**: `string`

Defined in: packages/types/dist/index.d.ts:1077

Sapling: diversifier

***

### diversifiedtransmissionkey?

> `optional` **diversifiedtransmissionkey**: `string`

Defined in: packages/types/dist/index.d.ts:1079

Sapling: diversified transmission key
