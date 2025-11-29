[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / BatchPaymentRequest

# Interface: BatchPaymentRequest

Defined in: packages/types/dist/index.d.ts:1644

Batch payment request

## Properties

### token

> **token**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:1646

Token to transfer

***

### recipients

> **recipients**: [`BatchPaymentRecipient`](BatchPaymentRecipient.md)[]

Defined in: packages/types/dist/index.d.ts:1648

List of recipients

***

### totalAmount

> **totalAmount**: `bigint`

Defined in: packages/types/dist/index.d.ts:1650

Total amount (sum of all recipients)

***

### privacy

> **privacy**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:1652

Privacy level for all payments

***

### viewingKey?

> `optional` **viewingKey**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:1654

Viewing key for compliant mode
