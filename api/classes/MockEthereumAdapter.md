[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / MockEthereumAdapter

# Class: MockEthereumAdapter

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:63](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L63)

Mock Ethereum wallet adapter for testing

## Example

```typescript
const adapter = new MockEthereumAdapter({
  address: '0x1234...',
  balance: 1_000_000_000_000_000_000n, // 1 ETH
})

await adapter.connect()
const balance = await adapter.getBalance()
```

## Extends

- [`BaseWalletAdapter`](BaseWalletAdapter.md)

## Constructors

### Constructor

> **new MockEthereumAdapter**(`config`): `MockEthereumAdapter`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:79](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L79)

#### Parameters

##### config

[`MockEthereumAdapterConfig`](../interfaces/MockEthereumAdapterConfig.md) = `{}`

#### Returns

`MockEthereumAdapter`

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`constructor`](BaseWalletAdapter.md#constructor)

## Properties

### chain

> `readonly` **chain**: `"ethereum"`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:64](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L64)

Chain this adapter connects to

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`chain`](BaseWalletAdapter.md#chain)

***

### name

> `readonly` **name**: `"mock-ethereum"` = `'mock-ethereum'`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:65](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L65)

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

### getChainId()

> **getChainId**(): `number`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:93](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L93)

Get current chain ID

#### Returns

`number`

***

### connect()

> **connect**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:100](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L100)

Connect to mock wallet

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`connect`](BaseWalletAdapter.md#connect)

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:132](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L132)

Disconnect from mock wallet

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`disconnect`](BaseWalletAdapter.md#disconnect)

***

### signMessage()

> **signMessage**(`message`): `Promise`\<[`Signature`](../interfaces/Signature.md)\>

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:139](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L139)

Sign a message

#### Parameters

##### message

`Uint8Array`

#### Returns

`Promise`\<[`Signature`](../interfaces/Signature.md)\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`signMessage`](BaseWalletAdapter.md#signmessage)

***

### signTypedData()

> **signTypedData**(`typedData`): `Promise`\<[`Signature`](../interfaces/Signature.md)\>

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:162](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L162)

Sign typed data (EIP-712)

#### Parameters

##### typedData

[`EIP712TypedData`](../interfaces/EIP712TypedData.md)

#### Returns

`Promise`\<[`Signature`](../interfaces/Signature.md)\>

***

### signTransaction()

> **signTransaction**(`tx`): `Promise`\<[`SignedTransaction`](../interfaces/SignedTransaction.md)\>

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:184](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L184)

Sign a transaction

#### Parameters

##### tx

[`UnsignedTransaction`](../interfaces/UnsignedTransaction.md)

#### Returns

`Promise`\<[`SignedTransaction`](../interfaces/SignedTransaction.md)\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`signTransaction`](BaseWalletAdapter.md#signtransaction)

***

### signAndSendTransaction()

> **signAndSendTransaction**(`tx`): `Promise`\<[`TransactionReceipt`](../interfaces/TransactionReceipt.md)\>

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:214](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L214)

Sign and send a transaction

#### Parameters

##### tx

[`UnsignedTransaction`](../interfaces/UnsignedTransaction.md)

#### Returns

`Promise`\<[`TransactionReceipt`](../interfaces/TransactionReceipt.md)\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`signAndSendTransaction`](BaseWalletAdapter.md#signandsendtransaction)

***

### getBalance()

> **getBalance**(): `Promise`\<`bigint`\>

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:241](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L241)

Get ETH balance

#### Returns

`Promise`\<`bigint`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`getBalance`](BaseWalletAdapter.md#getbalance)

***

### getTokenBalance()

> **getTokenBalance**(`asset`): `Promise`\<`bigint`\>

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:249](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L249)

Get ERC-20 token balance

#### Parameters

##### asset

[`Asset`](../interfaces/Asset.md)

#### Returns

`Promise`\<`bigint`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`getTokenBalance`](BaseWalletAdapter.md#gettokenbalance)

***

### switchChain()

> **switchChain**(`chainId`): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:270](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L270)

Switch chain (mock)

#### Parameters

##### chainId

`number`

#### Returns

`Promise`\<`void`\>

***

### setMockBalance()

> **setMockBalance**(`balance`): `void`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:290](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L290)

Set mock ETH balance

#### Parameters

##### balance

`bigint`

#### Returns

`void`

***

### setMockTokenBalance()

> **setMockTokenBalance**(`tokenAddress`, `balance`): `void`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:297](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L297)

Set mock token balance

#### Parameters

##### tokenAddress

`string`

##### balance

`bigint`

#### Returns

`void`

***

### getSignedTransactions()

> **getSignedTransactions**(): [`UnsignedTransaction`](../interfaces/UnsignedTransaction.md)[]

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:304](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L304)

Get signed transactions history

#### Returns

[`UnsignedTransaction`](../interfaces/UnsignedTransaction.md)[]

***

### getSentTransactions()

> **getSentTransactions**(): `string`[]

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:311](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L311)

Get sent transaction hashes

#### Returns

`string`[]

***

### clearTransactionHistory()

> **clearTransactionHistory**(): `void`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:318](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L318)

Clear transaction history

#### Returns

`void`

***

### simulateAccountChange()

> **simulateAccountChange**(`newAddress`): `void`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:326](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L326)

Simulate account change

#### Parameters

##### newAddress

`string`

#### Returns

`void`

***

### simulateDisconnect()

> **simulateDisconnect**(): `void`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:345](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/mock.ts#L345)

Simulate disconnect

#### Returns

`void`
