[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ShieldedPayment

# Interface: ShieldedPayment

Defined in: packages/types/dist/index.d.ts:1434

Shielded payment - a privacy-preserving stablecoin transfer

Unlike ShieldedIntent which is for cross-chain swaps, ShieldedPayment
is specifically for same-token transfers (e.g., USDC to USDC).

## Extended by

- [`TrackedPayment`](TrackedPayment.md)

## Properties

### paymentId

> **paymentId**: `string`

Defined in: packages/types/dist/index.d.ts:1436

Unique payment identifier

***

### version

> **version**: `string`

Defined in: packages/types/dist/index.d.ts:1438

SIP version

***

### privacyLevel

> **privacyLevel**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:1440

Privacy level for this payment

***

### createdAt

> **createdAt**: `number`

Defined in: packages/types/dist/index.d.ts:1442

Creation timestamp (Unix seconds)

***

### expiry

> **expiry**: `number`

Defined in: packages/types/dist/index.d.ts:1444

Expiration timestamp (Unix seconds)

***

### token

> **token**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:1446

The token being transferred

***

### amount

> **amount**: `bigint`

Defined in: packages/types/dist/index.d.ts:1448

Amount in smallest units (hidden via commitment in shielded mode)

***

### amountCommitment?

> `optional` **amountCommitment**: [`Commitment`](Commitment.md)

Defined in: packages/types/dist/index.d.ts:1450

Pedersen commitment to amount (for shielded mode)

***

### senderCommitment?

> `optional` **senderCommitment**: [`Commitment`](Commitment.md)

Defined in: packages/types/dist/index.d.ts:1452

Pedersen commitment to sender (for shielded mode)

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

***

### recipientAddress?

> `optional` **recipientAddress**: `string`

Defined in: packages/types/dist/index.d.ts:1460

Direct recipient address (for transparent mode)

***

### sourceChain

> **sourceChain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:1462

Source chain

***

### destinationChain

> **destinationChain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:1464

Destination chain (can be same as source for same-chain transfers)

***

### purpose?

> `optional` **purpose**: [`PaymentPurpose`](../type-aliases/PaymentPurpose.md)

Defined in: packages/types/dist/index.d.ts:1466

Payment purpose (for compliance)

***

### memo?

> `optional` **memo**: `string`

Defined in: packages/types/dist/index.d.ts:1468

Optional memo/reference (encrypted in shielded mode)

***

### encryptedMemo?

> `optional` **encryptedMemo**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:1470

Encrypted memo (for shielded mode with viewing key)

***

### fundingProof?

> `optional` **fundingProof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:1472

Funding proof (balance >= amount)

***

### authorizationProof?

> `optional` **authorizationProof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:1474

Authorization proof

***

### viewingKeyHash?

> `optional` **viewingKeyHash**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:1476

Viewing key hash (for compliant mode)
