[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / WalletShieldedSendResult

# Interface: WalletShieldedSendResult

Defined in: packages/types/dist/index.d.ts:2435

Result of a shielded send operation

## Properties

### txHash

> **txHash**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:2437

Transaction hash

***

### isShielded

> **isShielded**: `boolean`

Defined in: packages/types/dist/index.d.ts:2439

Whether the transaction used shielded pools

***

### ephemeralPublicKey?

> `optional` **ephemeralPublicKey**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:2441

Ephemeral public key (for stealth address sends)

***

### fee

> **fee**: `bigint`

Defined in: packages/types/dist/index.d.ts:2443

Fee paid
