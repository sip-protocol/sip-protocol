[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ShieldedIntent

# Interface: ShieldedIntent

Defined in: packages/types/dist/index.d.ts:217

Shielded Intent - core data structure

Public fields are visible to solvers for quoting.
Private fields are hidden and verified via ZK proofs.

## Extended by

- [`TrackedIntent`](TrackedIntent.md)

## Properties

### intentId

> **intentId**: `string`

Defined in: packages/types/dist/index.d.ts:219

Unique intent identifier

***

### version

> **version**: `"sip-v1"`

Defined in: packages/types/dist/index.d.ts:221

Protocol version

***

### privacyLevel

> **privacyLevel**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:223

Privacy level for this intent

***

### createdAt

> **createdAt**: `number`

Defined in: packages/types/dist/index.d.ts:225

Intent creation timestamp

***

### expiry

> **expiry**: `number`

Defined in: packages/types/dist/index.d.ts:227

Intent expiry timestamp

***

### outputAsset

> **outputAsset**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:229

Desired output asset

***

### minOutputAmount

> **minOutputAmount**: `bigint`

Defined in: packages/types/dist/index.d.ts:231

Minimum acceptable output amount

***

### maxSlippage

> **maxSlippage**: `number`

Defined in: packages/types/dist/index.d.ts:233

Maximum acceptable slippage

***

### inputCommitment

> **inputCommitment**: [`Commitment`](Commitment.md)

Defined in: packages/types/dist/index.d.ts:235

Commitment to input amount (Pedersen commitment)

***

### senderCommitment

> **senderCommitment**: [`Commitment`](Commitment.md)

Defined in: packages/types/dist/index.d.ts:237

Commitment to sender identity

***

### recipientStealth

> **recipientStealth**: [`StealthAddress`](StealthAddress.md)

Defined in: packages/types/dist/index.d.ts:239

Stealth address for receiving output

***

### fundingProof

> **fundingProof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:241

Proof of sufficient funds

***

### validityProof

> **validityProof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:243

Proof of intent validity

***

### viewingKeyHash?

> `optional` **viewingKeyHash**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:245

Hash of viewing key (if compliant mode)
