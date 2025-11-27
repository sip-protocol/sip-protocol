[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / generateStealthMetaAddress

# Function: generateStealthMetaAddress()

> **generateStealthMetaAddress**(`chain`, `label?`): `object`

Defined in: [packages/sdk/src/stealth.ts:41](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/stealth.ts#L41)

Generate a new stealth meta-address keypair

## Parameters

### chain

[`ChainId`](../type-aliases/ChainId.md)

Target chain for the addresses

### label?

`string`

Optional human-readable label

## Returns

`object`

Stealth meta-address and private keys

### metaAddress

> **metaAddress**: [`StealthMetaAddress`](../interfaces/StealthMetaAddress.md)

### spendingPrivateKey

> **spendingPrivateKey**: `` `0x${string}` ``

### viewingPrivateKey

> **viewingPrivateKey**: `` `0x${string}` ``

## Throws

If chain is invalid
