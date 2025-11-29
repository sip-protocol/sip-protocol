[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ShieldedSendParams

# Interface: ShieldedSendParams

Defined in: [packages/sdk/src/zcash/shielded-service.ts:62](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L62)

Shielded send parameters

## Properties

### to

> **to**: `string`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:64](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L64)

Recipient address (shielded or unified)

***

### amount

> **amount**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:66](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L66)

Amount in ZEC

***

### memo?

> `optional` **memo**: `string`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:68](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L68)

Optional memo (max 512 bytes)

***

### privacyLevel?

> `optional` **privacyLevel**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: [packages/sdk/src/zcash/shielded-service.ts:70](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L70)

SIP privacy level

***

### from?

> `optional` **from**: `string`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:72](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L72)

Source address (uses default if not specified)

***

### minConf?

> `optional` **minConf**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:74](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L74)

Minimum confirmations for inputs

***

### fee?

> `optional` **fee**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:76](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L76)

Custom fee (uses ZIP-317 default if not specified)
