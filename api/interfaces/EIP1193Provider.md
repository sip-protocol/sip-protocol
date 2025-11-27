[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / EIP1193Provider

# Interface: EIP1193Provider

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:18](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/types.ts#L18)

EIP-1193 Provider interface
Standard interface for Ethereum providers (MetaMask, etc.)

## Properties

### isMetaMask?

> `optional` **isMetaMask**: `boolean`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:25](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/types.ts#L25)

Provider is MetaMask

***

### isCoinbaseWallet?

> `optional` **isCoinbaseWallet**: `boolean`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:27](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/types.ts#L27)

Provider is Coinbase Wallet

***

### selectedAddress?

> `optional` **selectedAddress**: `string` \| `null`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:29](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/types.ts#L29)

Selected address (may be undefined before connection)

***

### chainId?

> `optional` **chainId**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:31](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/types.ts#L31)

Chain ID in hex format

## Methods

### request()

> **request**\<`T`\>(`args`): `Promise`\<`T`\>

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:20](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/types.ts#L20)

Make an Ethereum JSON-RPC request

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### args

[`EIP1193RequestArguments`](EIP1193RequestArguments.md)

#### Returns

`Promise`\<`T`\>

***

### on()

> **on**(`event`, `handler`): `void`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:22](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/types.ts#L22)

Event emitter for provider events

#### Parameters

##### event

`string`

##### handler

(...`args`) => `void`

#### Returns

`void`

***

### removeListener()

> **removeListener**(`event`, `handler`): `void`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:23](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/types.ts#L23)

#### Parameters

##### event

`string`

##### handler

(...`args`) => `void`

#### Returns

`void`

***

### isConnected()?

> `optional` **isConnected**(): `boolean`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:33](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/types.ts#L33)

Whether provider is connected

#### Returns

`boolean`
