[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / PedersenCommitment

# Interface: PedersenCommitment

Defined in: [packages/sdk/src/commitment.ts:35](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/commitment.ts#L35)

A Pedersen commitment with associated blinding factor

## Properties

### commitment

> **commitment**: `` `0x${string}` ``

Defined in: [packages/sdk/src/commitment.ts:39](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/commitment.ts#L39)

The commitment point C = v*G + r*H (compressed, 33 bytes)

***

### blinding

> **blinding**: `` `0x${string}` ``

Defined in: [packages/sdk/src/commitment.ts:45](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/commitment.ts#L45)

The blinding factor r (32 bytes, secret)
Required to open/verify the commitment
