[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / TrackedPayment

# Interface: TrackedPayment

Defined in: packages/types/dist/index.d.ts:1536

Payment tracking info

## Extends

- [`ShieldedPayment`](ShieldedPayment.md)

## Properties

### paymentId

> **paymentId**: `string`

Defined in: packages/types/dist/index.d.ts:1436

Unique payment identifier

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`paymentId`](ShieldedPayment.md#paymentid)

***

### version

> **version**: `string`

Defined in: packages/types/dist/index.d.ts:1438

SIP version

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`version`](ShieldedPayment.md#version)

***

### privacyLevel

> **privacyLevel**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:1440

Privacy level for this payment

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`privacyLevel`](ShieldedPayment.md#privacylevel)

***

### createdAt

> **createdAt**: `number`

Defined in: packages/types/dist/index.d.ts:1442

Creation timestamp (Unix seconds)

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`createdAt`](ShieldedPayment.md#createdat)

***

### expiry

> **expiry**: `number`

Defined in: packages/types/dist/index.d.ts:1444

Expiration timestamp (Unix seconds)

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`expiry`](ShieldedPayment.md#expiry)

***

### token

> **token**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:1446

The token being transferred

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`token`](ShieldedPayment.md#token)

***

### amount

> **amount**: `bigint`

Defined in: packages/types/dist/index.d.ts:1448

Amount in smallest units (hidden via commitment in shielded mode)

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`amount`](ShieldedPayment.md#amount)

***

### amountCommitment?

> `optional` **amountCommitment**: [`Commitment`](Commitment.md)

Defined in: packages/types/dist/index.d.ts:1450

Pedersen commitment to amount (for shielded mode)

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`amountCommitment`](ShieldedPayment.md#amountcommitment)

***

### senderCommitment?

> `optional` **senderCommitment**: [`Commitment`](Commitment.md)

Defined in: packages/types/dist/index.d.ts:1452

Pedersen commitment to sender (for shielded mode)

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`senderCommitment`](ShieldedPayment.md#sendercommitment)

***

### recipientStealth?

> `optional` **recipientStealth**: `object`

Defined in: packages/types/dist/index.d.ts:1454

Recipient stealth address (for shielded mode)

#### address

> **address**: `` `0x${string}` ``

#### ephemeralPublicKey

> **ephemeralPublicKey**: `` `0x${string}` ``

#### viewTag

> **viewTag**: `number`

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`recipientStealth`](ShieldedPayment.md#recipientstealth)

***

### recipientAddress?

> `optional` **recipientAddress**: `string`

Defined in: packages/types/dist/index.d.ts:1460

Direct recipient address (for transparent mode)

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`recipientAddress`](ShieldedPayment.md#recipientaddress)

***

### sourceChain

> **sourceChain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:1462

Source chain

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`sourceChain`](ShieldedPayment.md#sourcechain)

***

### destinationChain

> **destinationChain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:1464

Destination chain (can be same as source for same-chain transfers)

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`destinationChain`](ShieldedPayment.md#destinationchain)

***

### purpose?

> `optional` **purpose**: [`PaymentPurpose`](../type-aliases/PaymentPurpose.md)

Defined in: packages/types/dist/index.d.ts:1466

Payment purpose (for compliance)

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`purpose`](ShieldedPayment.md#purpose)

***

### memo?

> `optional` **memo**: `string`

Defined in: packages/types/dist/index.d.ts:1468

Optional memo/reference (encrypted in shielded mode)

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`memo`](ShieldedPayment.md#memo)

***

### encryptedMemo?

> `optional` **encryptedMemo**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:1470

Encrypted memo (for shielded mode with viewing key)

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`encryptedMemo`](ShieldedPayment.md#encryptedmemo)

***

### fundingProof?

> `optional` **fundingProof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:1472

Funding proof (balance >= amount)

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`fundingProof`](ShieldedPayment.md#fundingproof)

***

### authorizationProof?

> `optional` **authorizationProof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:1474

Authorization proof

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`authorizationProof`](ShieldedPayment.md#authorizationproof)

***

### viewingKeyHash?

> `optional` **viewingKeyHash**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:1476

Viewing key hash (for compliant mode)

#### Inherited from

[`ShieldedPayment`](ShieldedPayment.md).[`viewingKeyHash`](ShieldedPayment.md#viewingkeyhash)

***

### status

> **status**: [`PaymentStatusType`](../type-aliases/PaymentStatusType.md)

Defined in: packages/types/dist/index.d.ts:1538

Current status

***

### sourceTxHash?

> `optional` **sourceTxHash**: `string`

Defined in: packages/types/dist/index.d.ts:1540

Source transaction hash (once submitted)

***

### destinationTxHash?

> `optional` **destinationTxHash**: `string`

Defined in: packages/types/dist/index.d.ts:1542

Destination transaction hash (once settled)

***

### error?

> `optional` **error**: `string`

Defined in: packages/types/dist/index.d.ts:1544

Error message (if failed)
