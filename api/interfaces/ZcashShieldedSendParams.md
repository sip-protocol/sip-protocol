[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashShieldedSendParams

# Interface: ZcashShieldedSendParams

Defined in: packages/types/dist/index.d.ts:1142

Parameters for shielded send

## Properties

### fromAddress

> **fromAddress**: `string`

Defined in: packages/types/dist/index.d.ts:1144

Source address

***

### recipients

> **recipients**: [`ZcashSendRecipient`](ZcashSendRecipient.md)[]

Defined in: packages/types/dist/index.d.ts:1146

Recipients

***

### minConf?

> `optional` **minConf**: `number`

Defined in: packages/types/dist/index.d.ts:1148

Minimum confirmations (default: 10)

***

### fee?

> `optional` **fee**: `number`

Defined in: packages/types/dist/index.d.ts:1150

Fee in ZEC (default: ZIP 317 calculation)

***

### privacyPolicy?

> `optional` **privacyPolicy**: [`ZcashPrivacyPolicy`](../type-aliases/ZcashPrivacyPolicy.md)

Defined in: packages/types/dist/index.d.ts:1152

Privacy policy (default: LegacyCompat)
