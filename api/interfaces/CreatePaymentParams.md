[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / CreatePaymentParams

# Interface: CreatePaymentParams

Defined in: packages/types/dist/index.d.ts:1481

Parameters for creating a shielded payment

## Properties

### token

> **token**: [`Asset`](Asset.md) \| [`StablecoinSymbol`](../type-aliases/StablecoinSymbol.md)

Defined in: packages/types/dist/index.d.ts:1483

Token to transfer

***

### amount

> **amount**: `bigint`

Defined in: packages/types/dist/index.d.ts:1485

Amount in token's smallest units

***

### recipientMetaAddress?

> `optional` **recipientMetaAddress**: `string`

Defined in: packages/types/dist/index.d.ts:1487

Recipient's stealth meta-address (for privacy modes)

***

### recipientAddress?

> `optional` **recipientAddress**: `string`

Defined in: packages/types/dist/index.d.ts:1489

Direct recipient address (for transparent mode)

***

### privacy

> **privacy**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:1491

Privacy level

***

### viewingKey?

> `optional` **viewingKey**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:1493

Viewing key (required for compliant mode)

***

### sourceChain

> **sourceChain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:1495

Source chain

***

### destinationChain?

> `optional` **destinationChain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:1497

Destination chain (defaults to sourceChain)

***

### purpose?

> `optional` **purpose**: [`PaymentPurpose`](../type-aliases/PaymentPurpose.md)

Defined in: packages/types/dist/index.d.ts:1499

Payment purpose

***

### memo?

> `optional` **memo**: `string`

Defined in: packages/types/dist/index.d.ts:1501

Optional memo/reference

***

### ttl?

> `optional` **ttl**: `number`

Defined in: packages/types/dist/index.d.ts:1503

Time to live in seconds (default: 3600 = 1 hour)
