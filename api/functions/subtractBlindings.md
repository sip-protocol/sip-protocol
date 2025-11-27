[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / subtractBlindings

# Function: subtractBlindings()

> **subtractBlindings**(`b1`, `b2`): `` `0x${string}` ``

Defined in: [packages/sdk/src/commitment.ts:408](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/commitment.ts#L408)

Subtract blinding factors (for use with homomorphic subtraction)

## Parameters

### b1

`` `0x${string}` ``

First blinding factor

### b2

`` `0x${string}` ``

Second blinding factor (to subtract)

## Returns

`` `0x${string}` ``

Difference of blindings (mod curve order)
