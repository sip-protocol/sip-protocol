[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SolverVisibleIntent

# Interface: SolverVisibleIntent

Defined in: packages/types/dist/index.d.ts:396

What solvers can see from a ShieldedIntent

This type represents the PUBLIC view of an intent that solvers
receive when evaluating whether to provide a quote.

Privacy guarantees:
- Sender identity: HIDDEN (only commitment visible)
- Input amount: HIDDEN (only commitment visible)
- Recipient: ONE-TIME stealth address (unlinkable)
- Output requirements: VISIBLE (needed for quoting)

## Properties

### intentId

> **intentId**: `string`

Defined in: packages/types/dist/index.d.ts:398

Intent identifier

***

### version

> **version**: `string`

Defined in: packages/types/dist/index.d.ts:400

Protocol version

***

### privacyLevel

> **privacyLevel**: `string`

Defined in: packages/types/dist/index.d.ts:402

Privacy level (affects what proofs are required)

***

### createdAt

> **createdAt**: `number`

Defined in: packages/types/dist/index.d.ts:404

Intent creation timestamp

***

### expiry

> **expiry**: `number`

Defined in: packages/types/dist/index.d.ts:406

Intent expiry timestamp

***

### outputAsset

> **outputAsset**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:408

Desired output asset (VISIBLE)

***

### minOutputAmount

> **minOutputAmount**: `bigint`

Defined in: packages/types/dist/index.d.ts:410

Minimum acceptable output amount (VISIBLE)

***

### maxSlippage

> **maxSlippage**: `number`

Defined in: packages/types/dist/index.d.ts:412

Maximum acceptable slippage (VISIBLE)

***

### inputCommitment

> **inputCommitment**: [`Commitment`](Commitment.md)

Defined in: packages/types/dist/index.d.ts:414

Commitment to input amount - solver cannot see actual amount

***

### senderCommitment

> **senderCommitment**: [`Commitment`](Commitment.md)

Defined in: packages/types/dist/index.d.ts:416

Commitment to sender - solver cannot see sender identity

***

### recipientStealthAddress

> **recipientStealthAddress**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:418

One-time stealth address - unlinkable to recipient's identity

***

### ephemeralPublicKey

> **ephemeralPublicKey**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:420

Ephemeral public key for stealth derivation

***

### fundingProof

> **fundingProof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:422

Funding proof (proves sufficient balance without revealing amount)

***

### validityProof

> **validityProof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:424

Validity proof (proves intent is well-formed)
