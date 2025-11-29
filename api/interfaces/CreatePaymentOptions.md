[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / CreatePaymentOptions

# Interface: CreatePaymentOptions

Defined in: [packages/sdk/src/payment/payment.ts:52](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L52)

Options for creating a shielded payment

## Properties

### senderAddress?

> `optional` **senderAddress**: `string`

Defined in: [packages/sdk/src/payment/payment.ts:54](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L54)

Sender address (for ownership proof)

***

### proofProvider?

> `optional` **proofProvider**: [`ProofProvider`](ProofProvider.md)

Defined in: [packages/sdk/src/payment/payment.ts:56](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L56)

Proof provider for generating ZK proofs
