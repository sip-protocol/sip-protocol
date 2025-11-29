[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / PrivacyConfig

# Interface: PrivacyConfig

Defined in: [packages/sdk/src/privacy.ts:39](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/privacy.ts#L39)

Privacy configuration for an intent

## Properties

### level

> **level**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: [packages/sdk/src/privacy.ts:41](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/privacy.ts#L41)

The privacy level

***

### viewingKey?

> `optional` **viewingKey**: [`ViewingKey`](ViewingKey.md)

Defined in: [packages/sdk/src/privacy.ts:43](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/privacy.ts#L43)

Viewing key (required for compliant mode)

***

### useStealth

> **useStealth**: `boolean`

Defined in: [packages/sdk/src/privacy.ts:45](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/privacy.ts#L45)

Whether to use stealth addresses

***

### encryptData

> **encryptData**: `boolean`

Defined in: [packages/sdk/src/privacy.ts:47](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/privacy.ts#L47)

Whether to encrypt transaction data
