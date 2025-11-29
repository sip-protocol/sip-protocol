[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / MockWalletAdapter

# Class: MockWalletAdapter

Defined in: [packages/sdk/src/wallet/base-adapter.ts:261](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L261)

Mock wallet adapter for testing

Provides a complete wallet implementation with mock data.
Useful for testing and development without real wallet connections.

## Example

```typescript
const mockWallet = new MockWalletAdapter({
  chain: 'solana',
  address: 'SoLaNaAddReSS...',
  balance: 1000000000n, // 1 SOL
})

await mockWallet.connect()
const balance = await mockWallet.getBalance()
```

## Extends

- [`BaseWalletAdapter`](BaseWalletAdapter.md)

## Constructors

### Constructor

> **new MockWalletAdapter**(`options`): `MockWalletAdapter`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:272](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L272)

#### Parameters

##### options

###### chain

[`ChainId`](../type-aliases/ChainId.md)

###### address?

`string`

###### publicKey?

`` `0x${string}` ``

###### balance?

`bigint`

###### tokenBalances?

`Record`\<`string`, `bigint`\>

###### name?

`string`

###### shouldFailConnect?

`boolean`

###### shouldFailSign?

`boolean`

#### Returns

`MockWalletAdapter`

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`constructor`](BaseWalletAdapter.md#constructor)

## Properties

### chain

> `readonly` **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: [packages/sdk/src/wallet/base-adapter.ts:262](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L262)

Chain this adapter connects to

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`chain`](BaseWalletAdapter.md#chain)

***

### name

> `readonly` **name**: `string`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:263](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L263)

Wallet name/identifier (e.g., 'phantom', 'metamask')

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`name`](BaseWalletAdapter.md#name)

## Accessors

### address

#### Get Signature

> **get** **address**(): `string`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:74](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L74)

Current address (empty string if not connected)

##### Returns

`string`

Current address (empty string if not connected)

#### Inherited from

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`address`](BaseWalletAdapter.md#address)

***

### publicKey

#### Get Signature

> **get** **publicKey**(): `""` \| `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/base-adapter.ts:78](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L78)

Public key (hex encoded, empty string if not connected)

##### Returns

`""` \| `` `0x${string}` ``

Public key (hex encoded, empty string if not connected)

#### Inherited from

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`publicKey`](BaseWalletAdapter.md#publickey)

***

### connectionState

#### Get Signature

> **get** **connectionState**(): [`WalletConnectionState`](../type-aliases/WalletConnectionState.md)

Defined in: [packages/sdk/src/wallet/base-adapter.ts:82](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L82)

Current connection state

##### Returns

[`WalletConnectionState`](../type-aliases/WalletConnectionState.md)

Current connection state

#### Inherited from

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`connectionState`](BaseWalletAdapter.md#connectionstate)

## Methods

### on()

> **on**\<`T`\>(`event`, `handler`): `void`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:99](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L99)

Subscribe to wallet events

#### Type Parameters

##### T

`T` *extends* [`WalletEventType`](../type-aliases/WalletEventType.md)

#### Parameters

##### event

`T`

##### handler

[`WalletEventHandler`](../type-aliases/WalletEventHandler.md)\<`Extract`\<[`WalletConnectEvent`](../interfaces/WalletConnectEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletDisconnectEvent`](../interfaces/WalletDisconnectEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletAccountChangedEvent`](../interfaces/WalletAccountChangedEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletChainChangedEvent`](../interfaces/WalletChainChangedEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletErrorEvent`](../interfaces/WalletErrorEvent.md), \{ `type`: `T`; \}\>\>

#### Returns

`void`

#### Inherited from

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`on`](BaseWalletAdapter.md#on)

***

### off()

> **off**\<`T`\>(`event`, `handler`): `void`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:110](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L110)

Unsubscribe from wallet events

#### Type Parameters

##### T

`T` *extends* [`WalletEventType`](../type-aliases/WalletEventType.md)

#### Parameters

##### event

`T`

##### handler

[`WalletEventHandler`](../type-aliases/WalletEventHandler.md)\<`Extract`\<[`WalletConnectEvent`](../interfaces/WalletConnectEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletDisconnectEvent`](../interfaces/WalletDisconnectEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletAccountChangedEvent`](../interfaces/WalletAccountChangedEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletChainChangedEvent`](../interfaces/WalletChainChangedEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletErrorEvent`](../interfaces/WalletErrorEvent.md), \{ `type`: `T`; \}\>\>

#### Returns

`void`

#### Inherited from

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`off`](BaseWalletAdapter.md#off)

***

### isConnected()

> **isConnected**(): `boolean`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:191](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L191)

Check if wallet is connected

#### Returns

`boolean`

#### Inherited from

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`isConnected`](BaseWalletAdapter.md#isconnected)

***

### connect()

> **connect**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:293](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L293)

Connect to the wallet

#### Returns

`Promise`\<`void`\>

#### Throws

If connection fails

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`connect`](BaseWalletAdapter.md#connect)

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:313](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L313)

Disconnect from the wallet

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`disconnect`](BaseWalletAdapter.md#disconnect)

***

### signMessage()

> **signMessage**(`message`): `Promise`\<[`Signature`](../interfaces/Signature.md)\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:317](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L317)

Sign an arbitrary message

#### Parameters

##### message

`Uint8Array`

The message bytes to sign

#### Returns

`Promise`\<[`Signature`](../interfaces/Signature.md)\>

The signature

#### Throws

If signing fails or wallet not connected

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`signMessage`](BaseWalletAdapter.md#signmessage)

***

### signTransaction()

> **signTransaction**(`tx`): `Promise`\<[`SignedTransaction`](../interfaces/SignedTransaction.md)\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:337](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L337)

Sign a transaction

#### Parameters

##### tx

[`UnsignedTransaction`](../interfaces/UnsignedTransaction.md)

The unsigned transaction

#### Returns

`Promise`\<[`SignedTransaction`](../interfaces/SignedTransaction.md)\>

The signed transaction

#### Throws

If signing fails or wallet not connected

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`signTransaction`](BaseWalletAdapter.md#signtransaction)

***

### signAndSendTransaction()

> **signAndSendTransaction**(`tx`): `Promise`\<[`TransactionReceipt`](../interfaces/TransactionReceipt.md)\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:355](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L355)

Sign and broadcast a transaction

#### Parameters

##### tx

[`UnsignedTransaction`](../interfaces/UnsignedTransaction.md)

The unsigned transaction

#### Returns

`Promise`\<[`TransactionReceipt`](../interfaces/TransactionReceipt.md)\>

The transaction receipt

#### Throws

If signing or broadcast fails

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`signAndSendTransaction`](BaseWalletAdapter.md#signandsendtransaction)

***

### getBalance()

> **getBalance**(): `Promise`\<`bigint`\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:370](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L370)

Get native token balance

#### Returns

`Promise`\<`bigint`\>

Balance in smallest unit (lamports, wei, etc.)

#### Throws

If query fails

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`getBalance`](BaseWalletAdapter.md#getbalance)

***

### getTokenBalance()

> **getTokenBalance**(`asset`): `Promise`\<`bigint`\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:375](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L375)

Get token balance for a specific asset

#### Parameters

##### asset

[`Asset`](../interfaces/Asset.md)

The asset to query balance for

#### Returns

`Promise`\<`bigint`\>

Balance in smallest unit

#### Throws

If query fails or asset not supported

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`getTokenBalance`](BaseWalletAdapter.md#gettokenbalance)

***

### setMockBalance()

> **setMockBalance**(`balance`): `void`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:386](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L386)

Set mock balance (for testing)

#### Parameters

##### balance

`bigint`

#### Returns

`void`

***

### setMockTokenBalance()

> **setMockTokenBalance**(`asset`, `balance`): `void`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:393](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L393)

Set mock token balance (for testing)

#### Parameters

##### asset

[`Asset`](../interfaces/Asset.md)

##### balance

`bigint`

#### Returns

`void`

***

### simulateAccountChange()

> **simulateAccountChange**(`newAddress`): `void`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:401](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/base-adapter.ts#L401)

Simulate account change (for testing)

#### Parameters

##### newAddress

`string`

#### Returns

`void`
