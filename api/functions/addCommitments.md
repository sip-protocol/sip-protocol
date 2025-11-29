[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / addCommitments

# Function: addCommitments()

> **addCommitments**(`c1`, `c2`): [`CommitmentPoint`](../interfaces/CommitmentPoint.md)

Defined in: [packages/sdk/src/commitment.ts:298](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/commitment.ts#L298)

Add two commitments homomorphically

C1 + C2 = (v1*G + r1*H) + (v2*G + r2*H) = (v1+v2)*G + (r1+r2)*H

Note: The blinding factors also add. If you need to verify the sum,
you must also sum the blinding factors.

## Parameters

### c1

`` `0x${string}` ``

First commitment point

### c2

`` `0x${string}` ``

Second commitment point

## Returns

[`CommitmentPoint`](../interfaces/CommitmentPoint.md)

Sum of commitments

## Throws

If commitments are invalid hex strings
