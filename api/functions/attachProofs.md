[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / attachProofs

# Function: attachProofs()

> **attachProofs**(`intent`, `fundingProof`, `validityProof`): [`ShieldedIntent`](../interfaces/ShieldedIntent.md)

Defined in: [packages/sdk/src/intent.ts:402](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/intent.ts#L402)

Attach proofs to a shielded intent

For SHIELDED and COMPLIANT modes, proofs are required before the intent
can be submitted. This function attaches the proofs to an intent.

## Parameters

### intent

[`ShieldedIntent`](../interfaces/ShieldedIntent.md)

The intent to attach proofs to

### fundingProof

[`ZKProof`](../interfaces/ZKProof.md)

The funding proof (balance >= minimum)

### validityProof

[`ZKProof`](../interfaces/ZKProof.md)

The validity proof (authorization)

## Returns

[`ShieldedIntent`](../interfaces/ShieldedIntent.md)

The intent with proofs attached
