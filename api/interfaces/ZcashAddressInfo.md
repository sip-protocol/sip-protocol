[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashAddressInfo

# Interface: ZcashAddressInfo

Defined in: packages/types/dist/index.d.ts:1031

Address validation result

## Properties

### isvalid

> **isvalid**: `boolean`

Defined in: packages/types/dist/index.d.ts:1033

Whether the address is valid

***

### address?

> `optional` **address**: `string`

Defined in: packages/types/dist/index.d.ts:1035

The validated address

***

### address\_type?

> `optional` **address\_type**: [`ZcashAddressType`](../type-aliases/ZcashAddressType.md)

Defined in: packages/types/dist/index.d.ts:1037

Address type

***

### type?

> `optional` **type**: [`ZcashAddressType`](../type-aliases/ZcashAddressType.md)

Defined in: packages/types/dist/index.d.ts:1039

Deprecated: same as address_type

***

### ismine?

> `optional` **ismine**: `boolean`

Defined in: packages/types/dist/index.d.ts:1041

Whether the address belongs to this wallet

***

### payingkey?

> `optional` **payingkey**: `string`

Defined in: packages/types/dist/index.d.ts:1043

Sprout: paying key

***

### transmissionkey?

> `optional` **transmissionkey**: `string`

Defined in: packages/types/dist/index.d.ts:1045

Sprout: transmission key

***

### diversifier?

> `optional` **diversifier**: `string`

Defined in: packages/types/dist/index.d.ts:1047

Sapling: diversifier

***

### diversifiedtransmissionkey?

> `optional` **diversifiedtransmissionkey**: `string`

Defined in: packages/types/dist/index.d.ts:1049

Sapling: diversified transmission key
