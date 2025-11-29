[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / CreateIntentOptions

# Interface: CreateIntentOptions

Defined in: [packages/sdk/src/intent.ts:45](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/intent.ts#L45)

Options for creating a shielded intent

## Properties

### senderAddress?

> `optional` **senderAddress**: `string`

Defined in: [packages/sdk/src/intent.ts:47](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/intent.ts#L47)

Sender address (for ownership proof)

***

### proofProvider?

> `optional` **proofProvider**: [`ProofProvider`](ProofProvider.md)

Defined in: [packages/sdk/src/intent.ts:52](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/intent.ts#L52)

Proof provider for generating ZK proofs
If provided and privacy level requires proofs, they will be generated automatically
