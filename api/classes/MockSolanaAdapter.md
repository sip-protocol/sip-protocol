[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / MockSolanaAdapter

# Class: MockSolanaAdapter

Defined in: [packages/sdk/src/wallet/solana/mock.ts:127](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L127)

Mock Solana wallet adapter for testing

Provides full Solana wallet functionality with mock data.
No browser environment or actual wallet required.

## Example

```typescript
const wallet = new MockSolanaAdapter({
  address: 'TestWalletAddress123',
  balance: 5_000_000_000n, // 5 SOL
})

await wallet.connect()
const balance = await wallet.getBalance() // 5_000_000_000n

// Simulate failures
const failingWallet = new MockSolanaAdapter({
  shouldFailSign: true,
})
```

## Extends

- [`BaseWalletAdapter`](BaseWalletAdapter.md)

## Constructors

### Constructor

> **new MockSolanaAdapter**(`config`): `MockSolanaAdapter`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:145](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L145)

#### Parameters

##### config

[`MockSolanaAdapterConfig`](../interfaces/MockSolanaAdapterConfig.md) = `{}`

#### Returns

`MockSolanaAdapter`

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`constructor`](BaseWalletAdapter.md#constructor)

## Properties

### chain

> `readonly` **chain**: `"solana"`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:128](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L128)

Chain this adapter connects to

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`chain`](BaseWalletAdapter.md#chain)

***

### name

> `readonly` **name**: `"mock-solana"` = `'mock-solana'`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:129](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L129)

Wallet name/identifier (e.g., 'phantom', 'metamask')

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`name`](BaseWalletAdapter.md#name)

## Accessors

### address

#### Get Signature

> **get** **address**(): `string`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:74](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L74)

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

Defined in: [packages/sdk/src/wallet/base-adapter.ts:78](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L78)

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

Defined in: [packages/sdk/src/wallet/base-adapter.ts:82](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L82)

Current connection state

##### Returns

[`WalletConnectionState`](../type-aliases/WalletConnectionState.md)

Current connection state

#### Inherited from

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`connectionState`](BaseWalletAdapter.md#connectionstate)

## Methods

### on()

> **on**\<`T`\>(`event`, `handler`): `void`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:99](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L99)

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

Defined in: [packages/sdk/src/wallet/base-adapter.ts:110](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L110)

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

Defined in: [packages/sdk/src/wallet/base-adapter.ts:191](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L191)

Check if wallet is connected

#### Returns

`boolean`

#### Inherited from

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`isConnected`](BaseWalletAdapter.md#isconnected)

***

### getCluster()

> **getCluster**(): [`SolanaCluster`](../type-aliases/SolanaCluster.md)

Defined in: [packages/sdk/src/wallet/solana/mock.ts:161](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L161)

Get the current Solana cluster

#### Returns

[`SolanaCluster`](../type-aliases/SolanaCluster.md)

***

### connect()

> **connect**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/solana/mock.ts:168](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L168)

Connect to the mock wallet

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`connect`](BaseWalletAdapter.md#connect)

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/solana/mock.ts:186](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L186)

Disconnect from the mock wallet

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`disconnect`](BaseWalletAdapter.md#disconnect)

***

### signMessage()

> **signMessage**(`message`): `Promise`\<[`Signature`](../interfaces/Signature.md)\>

Defined in: [packages/sdk/src/wallet/solana/mock.ts:194](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L194)

Sign a message

#### Parameters

##### message

`Uint8Array`

#### Returns

`Promise`\<[`Signature`](../interfaces/Signature.md)\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`signMessage`](BaseWalletAdapter.md#signmessage)

***

### signTransaction()

> **signTransaction**(`tx`): `Promise`\<[`SignedTransaction`](../interfaces/SignedTransaction.md)\>

Defined in: [packages/sdk/src/wallet/solana/mock.ts:217](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L217)

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

Defined in: [packages/sdk/src/wallet/solana/mock.ts:242](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L242)

Sign and send a transaction

#### Parameters

##### tx

[`UnsignedTransaction`](../interfaces/UnsignedTransaction.md)

#### Returns

`Promise`\<[`TransactionReceipt`](../interfaces/TransactionReceipt.md)\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`signAndSendTransaction`](BaseWalletAdapter.md#signandsendtransaction)

***

### signAllTransactions()

> **signAllTransactions**\<`T`\>(`transactions`): `Promise`\<`T`[]\>

Defined in: [packages/sdk/src/wallet/solana/mock.ts:270](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L270)

Sign multiple transactions

#### Type Parameters

##### T

`T` *extends* [`SolanaTransaction`](../interfaces/SolanaTransaction.md) \| [`SolanaVersionedTransaction`](../interfaces/SolanaVersionedTransaction.md)

#### Parameters

##### transactions

`T`[]

#### Returns

`Promise`\<`T`[]\>

***

### getBalance()

> **getBalance**(): `Promise`\<`bigint`\>

Defined in: [packages/sdk/src/wallet/solana/mock.ts:295](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L295)

Get SOL balance

#### Returns

`Promise`\<`bigint`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`getBalance`](BaseWalletAdapter.md#getbalance)

***

### getTokenBalance()

> **getTokenBalance**(`asset`): `Promise`\<`bigint`\>

Defined in: [packages/sdk/src/wallet/solana/mock.ts:304](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L304)

Get token balance

#### Parameters

##### asset

[`Asset`](../interfaces/Asset.md)

#### Returns

`Promise`\<`bigint`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`getTokenBalance`](BaseWalletAdapter.md#gettokenbalance)

***

### setMockBalance()

> **setMockBalance**(`balance`): `void`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:328](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L328)

Set mock balance

#### Parameters

##### balance

`bigint`

#### Returns

`void`

***

### setMockTokenBalance()

> **setMockTokenBalance**(`mintAddress`, `balance`): `void`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:335](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L335)

Set mock token balance

#### Parameters

##### mintAddress

`string`

##### balance

`bigint`

#### Returns

`void`

***

### getSignedTransactions()

> **getSignedTransactions**(): ([`SolanaTransaction`](../interfaces/SolanaTransaction.md) \| [`SolanaVersionedTransaction`](../interfaces/SolanaVersionedTransaction.md))[]

Defined in: [packages/sdk/src/wallet/solana/mock.ts:342](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L342)

Get all signed transactions (for verification)

#### Returns

([`SolanaTransaction`](../interfaces/SolanaTransaction.md) \| [`SolanaVersionedTransaction`](../interfaces/SolanaVersionedTransaction.md))[]

***

### getSentTransactions()

> **getSentTransactions**(): `string`[]

Defined in: [packages/sdk/src/wallet/solana/mock.ts:349](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L349)

Get all sent transaction signatures (for verification)

#### Returns

`string`[]

***

### clearTransactionHistory()

> **clearTransactionHistory**(): `void`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:356](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L356)

Clear transaction history

#### Returns

`void`

***

### simulateAccountChange()

> **simulateAccountChange**(`newAddress`): `void`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:364](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L364)

Simulate an account change event

#### Parameters

##### newAddress

`string`

#### Returns

`void`

***

### simulateDisconnect()

> **simulateDisconnect**(): `void`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:376](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/mock.ts#L376)

Simulate a disconnect event

#### Returns

`void`
