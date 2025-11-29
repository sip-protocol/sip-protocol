[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / createCommitment

# ~~Function: createCommitment()~~

> **createCommitment**(`value`, `blindingFactor?`): [`Commitment`](../interfaces/Commitment.md)

Defined in: [packages/sdk/src/crypto.ts:29](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/crypto.ts#L29)

Create a Pedersen commitment to a value

## Parameters

### value

`bigint`

The value to commit to

### blindingFactor?

`Uint8Array`\<`ArrayBufferLike`\>

Optional blinding factor (random if not provided)

## Returns

[`Commitment`](../interfaces/Commitment.md)

Commitment object (legacy format)

## Deprecated

Use `commit()` from './commitment' for new code.
            This wrapper maintains backward compatibility.
