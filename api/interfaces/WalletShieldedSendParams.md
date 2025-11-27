[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / WalletShieldedSendParams

# Interface: WalletShieldedSendParams

Defined in: packages/types/dist/index.d.ts:1591

Parameters for shielded send operations

## Properties

### to

> **to**: `string`

Defined in: packages/types/dist/index.d.ts:1593

Recipient address or stealth address

***

### amount

> **amount**: `bigint`

Defined in: packages/types/dist/index.d.ts:1595

Amount in smallest unit

***

### asset

> **asset**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:1597

Asset to send

***

### memo?

> `optional` **memo**: `string`

Defined in: packages/types/dist/index.d.ts:1599

Optional memo (may be encrypted)

***

### fullPrivacy?

> `optional` **fullPrivacy**: `boolean`

Defined in: packages/types/dist/index.d.ts:1601

Use full privacy (shielded pools if available)
