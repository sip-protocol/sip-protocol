[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / PaymentReceipt

# Interface: PaymentReceipt

Defined in: packages/types/dist/index.d.ts:1508

Payment receipt - returned after successful payment

## Properties

### paymentId

> **paymentId**: `string`

Defined in: packages/types/dist/index.d.ts:1510

Payment ID

***

### sourceTxHash

> **sourceTxHash**: `string`

Defined in: packages/types/dist/index.d.ts:1512

Transaction hash on source chain

***

### destinationTxHash?

> `optional` **destinationTxHash**: `string`

Defined in: packages/types/dist/index.d.ts:1514

Transaction hash on destination chain (if cross-chain)

***

### sourceBlock

> **sourceBlock**: `number`

Defined in: packages/types/dist/index.d.ts:1516

Block number on source chain

***

### destinationBlock?

> `optional` **destinationBlock**: `number`

Defined in: packages/types/dist/index.d.ts:1518

Block number on destination chain

***

### amount

> **amount**: `bigint`

Defined in: packages/types/dist/index.d.ts:1520

Actual amount transferred

***

### fees

> **fees**: `object`

Defined in: packages/types/dist/index.d.ts:1522

Fees paid

#### network

> **network**: `bigint`

Network/gas fees

#### protocol

> **protocol**: `bigint`

Protocol fees (if any)

***

### confirmedAt

> **confirmedAt**: `number`

Defined in: packages/types/dist/index.d.ts:1529

Timestamp of confirmation

***

### recipientAddress

> **recipientAddress**: `string`

Defined in: packages/types/dist/index.d.ts:1531

Recipient address (stealth or direct)
