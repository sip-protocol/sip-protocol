[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / StealthAddress

# Interface: StealthAddress

Defined in: packages/types/dist/index.d.ts:114

One-time stealth address for receiving funds

## Properties

### address

> **address**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:116

The stealth address (hex encoded)

***

### ephemeralPublicKey

> **ephemeralPublicKey**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:118

Ephemeral public key (R) - published alongside transaction

***

### viewTag

> **viewTag**: `number`

Defined in: packages/types/dist/index.d.ts:120

View tag for efficient scanning (first byte of shared secret)
