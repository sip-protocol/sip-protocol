[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / subtractCommitments

# Function: subtractCommitments()

> **subtractCommitments**(`c1`, `c2`): [`CommitmentPoint`](../interfaces/CommitmentPoint.md)

Defined in: [packages/sdk/src/commitment.ts:340](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/commitment.ts#L340)

Subtract two commitments homomorphically

C1 - C2 = (v1-v2)*G + (r1-r2)*H

## Parameters

### c1

`` `0x${string}` ``

First commitment point

### c2

`` `0x${string}` ``

Second commitment point (to subtract)

## Returns

[`CommitmentPoint`](../interfaces/CommitmentPoint.md)

Difference of commitments

## Throws

If commitments are invalid
