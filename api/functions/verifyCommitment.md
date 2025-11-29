[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / verifyCommitment

# ~~Function: verifyCommitment()~~

> **verifyCommitment**(`commitment`, `expectedValue`): `boolean`

Defined in: [packages/sdk/src/crypto.ts:51](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/crypto.ts#L51)

Verify a Pedersen commitment (requires knowing the value and blinding factor)

## Parameters

### commitment

[`Commitment`](../interfaces/Commitment.md)

### expectedValue

`bigint`

## Returns

`boolean`

## Deprecated

Use `verifyOpening()` from './commitment' for new code.
