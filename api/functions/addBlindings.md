[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / addBlindings

# Function: addBlindings()

> **addBlindings**(`b1`, `b2`): `` `0x${string}` ``

Defined in: [packages/sdk/src/commitment.ts:391](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/commitment.ts#L391)

Add blinding factors (for use with homomorphic addition)

When you add commitments, the result commits to (v1+v2) with
blinding (r1+r2). Use this to compute the combined blinding.

## Parameters

### b1

`` `0x${string}` ``

First blinding factor

### b2

`` `0x${string}` ``

Second blinding factor

## Returns

`` `0x${string}` ``

Sum of blindings (mod curve order)
