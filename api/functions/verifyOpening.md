[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / verifyOpening

# Function: verifyOpening()

> **verifyOpening**(`commitment`, `value`, `blinding`): `boolean`

Defined in: [packages/sdk/src/commitment.ts:227](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/commitment.ts#L227)

Verify that a commitment opens to a specific value

Recomputes C' = v*G + r*H and checks if C' == C

## Parameters

### commitment

`` `0x${string}` ``

The commitment point to verify

### value

`bigint`

The claimed value

### blinding

`` `0x${string}` ``

The blinding factor used

## Returns

`boolean`

true if the commitment opens correctly
