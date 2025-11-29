[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / checkStealthAddress

# Function: checkStealthAddress()

> **checkStealthAddress**(`stealthAddress`, `spendingPrivateKey`, `viewingPrivateKey`): `boolean`

Defined in: [packages/sdk/src/stealth.ts:306](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/stealth.ts#L306)

Check if a stealth address was intended for this recipient
Uses view tag for efficient filtering before full computation

## Parameters

### stealthAddress

[`StealthAddress`](../interfaces/StealthAddress.md)

Stealth address to check

### spendingPrivateKey

`` `0x${string}` ``

Recipient's spending private key

### viewingPrivateKey

`` `0x${string}` ``

Recipient's viewing private key

## Returns

`boolean`

true if this address belongs to the recipient

## Throws

If any input is invalid
