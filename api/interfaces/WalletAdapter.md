[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / WalletAdapter

# Interface: WalletAdapter

Defined in: [packages/sdk/src/sip.ts:62](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L62)

Wallet adapter interface

## Properties

### chain

> **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: [packages/sdk/src/sip.ts:64](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L64)

Connected chain

***

### address

> **address**: `string`

Defined in: [packages/sdk/src/sip.ts:66](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L66)

Wallet address

## Methods

### signMessage()

> **signMessage**(`message`): `Promise`\<`string`\>

Defined in: [packages/sdk/src/sip.ts:68](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L68)

Sign a message

#### Parameters

##### message

`string`

#### Returns

`Promise`\<`string`\>

***

### signTransaction()

> **signTransaction**(`tx`): `Promise`\<`unknown`\>

Defined in: [packages/sdk/src/sip.ts:70](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L70)

Sign a transaction

#### Parameters

##### tx

`unknown`

#### Returns

`Promise`\<`unknown`\>
