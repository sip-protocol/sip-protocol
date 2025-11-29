[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / BatchPaymentRecipient

# Interface: BatchPaymentRecipient

Defined in: packages/types/dist/index.d.ts:1631

Payment recipient in a batch

## Properties

### address

> **address**: `string`

Defined in: packages/types/dist/index.d.ts:1633

Recipient's stealth meta-address or direct address

***

### amount

> **amount**: `bigint`

Defined in: packages/types/dist/index.d.ts:1635

Amount in token's smallest units

***

### memo?

> `optional` **memo**: `string`

Defined in: packages/types/dist/index.d.ts:1637

Optional memo/reference

***

### purpose?

> `optional` **purpose**: [`PaymentPurpose`](../type-aliases/PaymentPurpose.md)

Defined in: packages/types/dist/index.d.ts:1639

Payment purpose
