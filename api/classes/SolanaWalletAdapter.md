[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SolanaWalletAdapter

# Class: SolanaWalletAdapter

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:71](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L71)

Solana wallet adapter

Provides SIP-compatible wallet interface for Solana.
Works with Phantom, Solflare, Backpack, and other Solana wallets.

## Examples

```typescript
const wallet = new SolanaWalletAdapter({ wallet: 'phantom' })
await wallet.connect()

const balance = await wallet.getBalance()
console.log(`Balance: ${balance} lamports`)

// Sign a message
const sig = await wallet.signMessage(new TextEncoder().encode('Hello'))
```

```typescript
const wallet = new SolanaWalletAdapter({
  wallet: 'phantom',
  cluster: 'devnet',
  rpcEndpoint: 'https://my-rpc.example.com',
})
```

## Extends

- [`BaseWalletAdapter`](BaseWalletAdapter.md)

## Constructors

### Constructor

> **new SolanaWalletAdapter**(`config`): `SolanaWalletAdapter`

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:86](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L86)

#### Parameters

##### config

[`SolanaAdapterConfig`](../interfaces/SolanaAdapterConfig.md) = `{}`

#### Returns

`SolanaWalletAdapter`

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`constructor`](BaseWalletAdapter.md#constructor)

## Properties

### chain

> `readonly` **chain**: `"solana"`

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:72](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L72)

Chain this adapter connects to

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`chain`](BaseWalletAdapter.md#chain)

***

### name

> `readonly` **name**: `string`

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:73](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L73)

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

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:105](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L105)

Get the current Solana cluster

#### Returns

[`SolanaCluster`](../type-aliases/SolanaCluster.md)

***

### getRpcEndpoint()

> **getRpcEndpoint**(): `string`

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:112](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L112)

Get the RPC endpoint

#### Returns

`string`

***

### setRpcEndpoint()

> **setRpcEndpoint**(`endpoint`): `void`

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:119](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L119)

Set the RPC endpoint

#### Parameters

##### endpoint

`string`

#### Returns

`void`

***

### connect()

> **connect**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:139](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L139)

Connect to the wallet

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`connect`](BaseWalletAdapter.md#connect)

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:195](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L195)

Disconnect from the wallet

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`disconnect`](BaseWalletAdapter.md#disconnect)

***

### signMessage()

> **signMessage**(`message`): `Promise`\<[`Signature`](../interfaces/Signature.md)\>

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:213](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L213)

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

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:245](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L245)

Sign a transaction

The transaction data should be a SolanaTransaction or SolanaVersionedTransaction

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

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:283](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L283)

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

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:323](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L323)

Sign multiple transactions at once

Solana-specific method for batch signing

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

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:350](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L350)

Get native SOL balance

#### Returns

`Promise`\<`bigint`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`getBalance`](BaseWalletAdapter.md#getbalance)

***

### getTokenBalance()

> **getTokenBalance**(`asset`): `Promise`\<`bigint`\>

Defined in: [packages/sdk/src/wallet/solana/adapter.ts:374](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/adapter.ts#L374)

Get SPL token balance

#### Parameters

##### asset

[`Asset`](../interfaces/Asset.md)

#### Returns

`Promise`\<`bigint`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`getTokenBalance`](BaseWalletAdapter.md#gettokenbalance)
