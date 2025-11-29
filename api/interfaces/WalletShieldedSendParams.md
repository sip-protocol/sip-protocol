[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / WalletShieldedSendParams

# Interface: WalletShieldedSendParams

Defined in: packages/types/dist/index.d.ts:2420

Parameters for shielded send operations

## Properties

### to

> **to**: `string`

Defined in: packages/types/dist/index.d.ts:2422

Recipient address or stealth address

***

### amount

> **amount**: `bigint`

Defined in: packages/types/dist/index.d.ts:2424

Amount in smallest unit

***

### asset

> **asset**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:2426

Asset to send

***

### memo?

> `optional` **memo**: `string`

Defined in: packages/types/dist/index.d.ts:2428

Optional memo (may be encrypted)

***

### fullPrivacy?

> `optional` **fullPrivacy**: `boolean`

Defined in: packages/types/dist/index.d.ts:2430

Use full privacy (shielded pools if available)
