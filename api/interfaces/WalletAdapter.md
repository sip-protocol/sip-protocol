[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / WalletAdapter

# Interface: WalletAdapter

Defined in: [packages/sdk/src/sip.ts:88](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L88)

Wallet adapter interface

## Properties

### chain

> **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: [packages/sdk/src/sip.ts:90](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L90)

Connected chain

***

### address

> **address**: `string`

Defined in: [packages/sdk/src/sip.ts:92](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L92)

Wallet address

## Methods

### signMessage()

> **signMessage**(`message`): `Promise`\<`string`\>

Defined in: [packages/sdk/src/sip.ts:94](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L94)

Sign a message

#### Parameters

##### message

`string`

#### Returns

`Promise`\<`string`\>

***

### signTransaction()

> **signTransaction**(`tx`): `Promise`\<`unknown`\>

Defined in: [packages/sdk/src/sip.ts:96](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L96)

Sign a transaction

#### Parameters

##### tx

`unknown`

#### Returns

`Promise`\<`unknown`\>

***

### sendTransaction()?

> `optional` **sendTransaction**(`tx`): `Promise`\<`string`\>

Defined in: [packages/sdk/src/sip.ts:98](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L98)

Send a transaction (optional)

#### Parameters

##### tx

`unknown`

#### Returns

`Promise`\<`string`\>
