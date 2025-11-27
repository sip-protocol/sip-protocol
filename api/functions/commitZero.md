[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / commitZero

# Function: commitZero()

> **commitZero**(`blinding`): [`PedersenCommitment`](../interfaces/PedersenCommitment.md)

Defined in: [packages/sdk/src/commitment.ts:279](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/commitment.ts#L279)

Create a commitment to zero with a specific blinding factor

C = 0*G + r*H = r*H

Useful for creating balance proofs.

## Parameters

### blinding

`Uint8Array`

The blinding factor

## Returns

[`PedersenCommitment`](../interfaces/PedersenCommitment.md)

Commitment to zero
