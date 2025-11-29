[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / generateStealthAddress

# Function: generateStealthAddress()

> **generateStealthAddress**(`recipientMetaAddress`): `object`

Defined in: [packages/sdk/src/stealth.ts:130](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/stealth.ts#L130)

Generate a one-time stealth address for a recipient

## Parameters

### recipientMetaAddress

[`StealthMetaAddress`](../interfaces/StealthMetaAddress.md)

Recipient's published stealth meta-address

## Returns

`object`

Stealth address data (address + ephemeral key for publication)

### stealthAddress

> **stealthAddress**: [`StealthAddress`](../interfaces/StealthAddress.md)

### sharedSecret

> **sharedSecret**: `` `0x${string}` ``

## Throws

If recipientMetaAddress is invalid
