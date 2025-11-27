[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / TrackedIntent

# Interface: TrackedIntent

Defined in: packages/types/dist/index.d.ts:324

Full intent with status tracking

## Extends

- [`ShieldedIntent`](ShieldedIntent.md)

## Properties

### intentId

> **intentId**: `string`

Defined in: packages/types/dist/index.d.ts:219

Unique intent identifier

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`intentId`](ShieldedIntent.md#intentid)

***

### version

> **version**: `"sip-v1"`

Defined in: packages/types/dist/index.d.ts:221

Protocol version

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`version`](ShieldedIntent.md#version)

***

### privacyLevel

> **privacyLevel**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:223

Privacy level for this intent

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`privacyLevel`](ShieldedIntent.md#privacylevel)

***

### createdAt

> **createdAt**: `number`

Defined in: packages/types/dist/index.d.ts:225

Intent creation timestamp

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`createdAt`](ShieldedIntent.md#createdat)

***

### expiry

> **expiry**: `number`

Defined in: packages/types/dist/index.d.ts:227

Intent expiry timestamp

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`expiry`](ShieldedIntent.md#expiry)

***

### outputAsset

> **outputAsset**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:229

Desired output asset

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`outputAsset`](ShieldedIntent.md#outputasset)

***

### minOutputAmount

> **minOutputAmount**: `bigint`

Defined in: packages/types/dist/index.d.ts:231

Minimum acceptable output amount

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`minOutputAmount`](ShieldedIntent.md#minoutputamount)

***

### maxSlippage

> **maxSlippage**: `number`

Defined in: packages/types/dist/index.d.ts:233

Maximum acceptable slippage

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`maxSlippage`](ShieldedIntent.md#maxslippage)

***

### inputCommitment

> **inputCommitment**: [`Commitment`](Commitment.md)

Defined in: packages/types/dist/index.d.ts:235

Commitment to input amount (Pedersen commitment)

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`inputCommitment`](ShieldedIntent.md#inputcommitment)

***

### senderCommitment

> **senderCommitment**: [`Commitment`](Commitment.md)

Defined in: packages/types/dist/index.d.ts:237

Commitment to sender identity

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`senderCommitment`](ShieldedIntent.md#sendercommitment)

***

### recipientStealth

> **recipientStealth**: [`StealthAddress`](StealthAddress.md)

Defined in: packages/types/dist/index.d.ts:239

Stealth address for receiving output

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`recipientStealth`](ShieldedIntent.md#recipientstealth)

***

### fundingProof

> **fundingProof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:241

Proof of sufficient funds

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`fundingProof`](ShieldedIntent.md#fundingproof)

***

### validityProof

> **validityProof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:243

Proof of intent validity

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`validityProof`](ShieldedIntent.md#validityproof)

***

### viewingKeyHash?

> `optional` **viewingKeyHash**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:245

Hash of viewing key (if compliant mode)

#### Inherited from

[`ShieldedIntent`](ShieldedIntent.md).[`viewingKeyHash`](ShieldedIntent.md#viewingkeyhash)

***

### status

> **status**: [`IntentStatus`](../enumerations/IntentStatus.md)

Defined in: packages/types/dist/index.d.ts:326

Current status

***

### quotes

> **quotes**: [`Quote`](Quote.md)[]

Defined in: packages/types/dist/index.d.ts:328

Received quotes

***

### selectedQuote?

> `optional` **selectedQuote**: [`Quote`](Quote.md)

Defined in: packages/types/dist/index.d.ts:330

Selected quote (if any)

***

### result?

> `optional` **result**: [`FulfillmentResult`](FulfillmentResult.md)

Defined in: packages/types/dist/index.d.ts:332

Fulfillment result (if completed)
