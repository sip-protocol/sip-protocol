[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / decodeStealthMetaAddress

# Function: decodeStealthMetaAddress()

> **decodeStealthMetaAddress**(`encoded`): [`StealthMetaAddress`](../interfaces/StealthMetaAddress.md)

Defined in: [packages/sdk/src/stealth.ts:384](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/stealth.ts#L384)

Decode a stealth meta-address from a string

## Parameters

### encoded

`string`

Encoded stealth meta-address (format: sip:<chain>:<spendingKey>:<viewingKey>)

## Returns

[`StealthMetaAddress`](../interfaces/StealthMetaAddress.md)

Decoded StealthMetaAddress

## Throws

If format is invalid or keys are malformed
