[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / commit

# Function: commit()

> **commit**(`value`, `blinding?`): [`PedersenCommitment`](../interfaces/PedersenCommitment.md)

Defined in: [packages/sdk/src/commitment.ts:158](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/commitment.ts#L158)

Create a Pedersen commitment to a value

C = v*G + r*H

Where:
- v = value (the amount being committed)
- r = blinding factor (random, keeps value hidden)
- G = base generator
- H = independent generator (NUMS)

## Parameters

### value

`bigint`

The value to commit to (must be < curve order)

### blinding?

`Uint8Array`\<`ArrayBufferLike`\>

Optional blinding factor (random 32 bytes if not provided)

## Returns

[`PedersenCommitment`](../interfaces/PedersenCommitment.md)

The commitment and blinding factor

## Example

```typescript
// Create a commitment to 100 tokens
const { commitment, blinding } = commit(100n)

// Later, prove the commitment contains 100
const valid = verifyOpening(commitment, 100n, blinding)
```
