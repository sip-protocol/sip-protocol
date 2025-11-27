[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / BaseWalletAdapter

# Abstract Class: BaseWalletAdapter

Defined in: [packages/sdk/src/wallet/base-adapter.ts:64](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L64)

Abstract base class for wallet adapters

Provides:
- Event emitter infrastructure
- Connection state management
- Common validation logic

Subclasses must implement:
- connect() / disconnect()
- signMessage() / signTransaction() / signAndSendTransaction()
- getBalance() / getTokenBalance()

## Example

```typescript
class MyWalletAdapter extends BaseWalletAdapter {
  readonly chain = 'solana'
  readonly name = 'my-wallet'

  async connect(): Promise<void> {
    // Implementation
  }

  // ... other required methods
}
```

## Extended by

- [`MockWalletAdapter`](MockWalletAdapter.md)
- [`SolanaWalletAdapter`](SolanaWalletAdapter.md)
- [`MockSolanaAdapter`](MockSolanaAdapter.md)
- [`EthereumWalletAdapter`](EthereumWalletAdapter.md)
- [`MockEthereumAdapter`](MockEthereumAdapter.md)

## Implements

- [`IWalletAdapter`](../interfaces/IWalletAdapter.md)

## Constructors

### Constructor

> **new BaseWalletAdapter**(): `BaseWalletAdapter`

#### Returns

`BaseWalletAdapter`

## Properties

### chain

> `abstract` `readonly` **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: [packages/sdk/src/wallet/base-adapter.ts:67](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L67)

Chain this adapter connects to

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`chain`](../interfaces/IWalletAdapter.md#chain)

***

### name

> `abstract` `readonly` **name**: `string`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:68](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L68)

Wallet name/identifier (e.g., 'phantom', 'metamask')

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`name`](../interfaces/IWalletAdapter.md#name)

## Accessors

### address

#### Get Signature

> **get** **address**(): `string`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:74](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L74)

Current address (empty string if not connected)

##### Returns

`string`

Current address (empty string if not connected)

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`address`](../interfaces/IWalletAdapter.md#address)

***

### publicKey

#### Get Signature

> **get** **publicKey**(): `""` \| `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/base-adapter.ts:78](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L78)

Public key (hex encoded, empty string if not connected)

##### Returns

`""` \| `` `0x${string}` ``

Public key (hex encoded, empty string if not connected)

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`publicKey`](../interfaces/IWalletAdapter.md#publickey)

***

### connectionState

#### Get Signature

> **get** **connectionState**(): [`WalletConnectionState`](../type-aliases/WalletConnectionState.md)

Defined in: [packages/sdk/src/wallet/base-adapter.ts:82](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L82)

Current connection state

##### Returns

[`WalletConnectionState`](../type-aliases/WalletConnectionState.md)

Current connection state

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`connectionState`](../interfaces/IWalletAdapter.md#connectionstate)

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

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`on`](../interfaces/IWalletAdapter.md#on)

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

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`off`](../interfaces/IWalletAdapter.md#off)

***

### isConnected()

> **isConnected**(): `boolean`

Defined in: [packages/sdk/src/wallet/base-adapter.ts:191](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L191)

Check if wallet is connected

#### Returns

`boolean`

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`isConnected`](../interfaces/IWalletAdapter.md#isconnected)

***

### connect()

> `abstract` **connect**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:234](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L234)

Connect to the wallet

#### Returns

`Promise`\<`void`\>

#### Throws

If connection fails

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`connect`](../interfaces/IWalletAdapter.md#connect)

***

### disconnect()

> `abstract` **disconnect**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:235](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L235)

Disconnect from the wallet

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`disconnect`](../interfaces/IWalletAdapter.md#disconnect)

***

### signMessage()

> `abstract` **signMessage**(`message`): `Promise`\<[`Signature`](../interfaces/Signature.md)\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:236](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L236)

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

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`signMessage`](../interfaces/IWalletAdapter.md#signmessage)

***

### signTransaction()

> `abstract` **signTransaction**(`tx`): `Promise`\<[`SignedTransaction`](../interfaces/SignedTransaction.md)\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:237](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L237)

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

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`signTransaction`](../interfaces/IWalletAdapter.md#signtransaction)

***

### signAndSendTransaction()

> `abstract` **signAndSendTransaction**(`tx`): `Promise`\<[`TransactionReceipt`](../interfaces/TransactionReceipt.md)\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:238](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L238)

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

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`signAndSendTransaction`](../interfaces/IWalletAdapter.md#signandsendtransaction)

***

### getBalance()

> `abstract` **getBalance**(): `Promise`\<`bigint`\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:239](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L239)

Get native token balance

#### Returns

`Promise`\<`bigint`\>

Balance in smallest unit (lamports, wei, etc.)

#### Throws

If query fails

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`getBalance`](../interfaces/IWalletAdapter.md#getbalance)

***

### getTokenBalance()

> `abstract` **getTokenBalance**(`asset`): `Promise`\<`bigint`\>

Defined in: [packages/sdk/src/wallet/base-adapter.ts:240](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/base-adapter.ts#L240)

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

#### Implementation of

[`IWalletAdapter`](../interfaces/IWalletAdapter.md).[`getTokenBalance`](../interfaces/IWalletAdapter.md#gettokenbalance)
