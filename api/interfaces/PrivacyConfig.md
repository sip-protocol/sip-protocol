[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / PrivacyConfig

# Interface: PrivacyConfig

Defined in: [packages/sdk/src/privacy.ts:38](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/privacy.ts#L38)

Privacy configuration for an intent

## Properties

### level

> **level**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: [packages/sdk/src/privacy.ts:40](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/privacy.ts#L40)

The privacy level

***

### viewingKey?

> `optional` **viewingKey**: [`ViewingKey`](ViewingKey.md)

Defined in: [packages/sdk/src/privacy.ts:42](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/privacy.ts#L42)

Viewing key (required for compliant mode)

***

### useStealth

> **useStealth**: `boolean`

Defined in: [packages/sdk/src/privacy.ts:44](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/privacy.ts#L44)

Whether to use stealth addresses

***

### encryptData

> **encryptData**: `boolean`

Defined in: [packages/sdk/src/privacy.ts:46](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/privacy.ts#L46)

Whether to encrypt transaction data
