[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / deriveStealthPrivateKey

# Function: deriveStealthPrivateKey()

> **deriveStealthPrivateKey**(`stealthAddress`, `spendingPrivateKey`, `viewingPrivateKey`): [`StealthAddressRecovery`](../interfaces/StealthAddressRecovery.md)

Defined in: [packages/sdk/src/stealth.ts:233](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/stealth.ts#L233)

Derive the private key for a stealth address (for recipient to claim funds)

## Parameters

### stealthAddress

[`StealthAddress`](../interfaces/StealthAddress.md)

The stealth address to recover

### spendingPrivateKey

`` `0x${string}` ``

Recipient's spending private key

### viewingPrivateKey

`` `0x${string}` ``

Recipient's viewing private key

## Returns

[`StealthAddressRecovery`](../interfaces/StealthAddressRecovery.md)

Recovery data including derived private key

## Throws

If any input is invalid
