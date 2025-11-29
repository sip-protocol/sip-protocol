[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / IWalletAdapter

# Interface: IWalletAdapter

Defined in: packages/types/dist/index.d.ts:2332

Core wallet adapter interface

Chain-agnostic interface that all wallet implementations must support.
Provides basic wallet operations: connection, signing, and balance queries.

## Example

```typescript
class SolanaWalletAdapter implements WalletAdapter {
  readonly chain = 'solana'

  async connect(): Promise<void> {
    // Connect to Phantom, Solflare, etc.
  }

  async signMessage(message: Uint8Array): Promise<Signature> {
    // Sign using connected wallet
  }
}
```

## Extended by

- [`PrivateWalletAdapter`](PrivateWalletAdapter.md)

## Properties

### chain

> `readonly` **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:2334

Chain this adapter connects to

***

### name

> `readonly` **name**: `string`

Defined in: packages/types/dist/index.d.ts:2336

Wallet name/identifier (e.g., 'phantom', 'metamask')

***

### address

> `readonly` **address**: `string`

Defined in: packages/types/dist/index.d.ts:2338

Current address (empty string if not connected)

***

### publicKey

> `readonly` **publicKey**: `""` \| `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:2340

Public key (hex encoded, empty string if not connected)

***

### connectionState

> `readonly` **connectionState**: [`WalletConnectionState`](../type-aliases/WalletConnectionState.md)

Defined in: packages/types/dist/index.d.ts:2344

Current connection state

## Methods

### connect()

> **connect**(): `Promise`\<`void`\>

Defined in: packages/types/dist/index.d.ts:2350

Connect to the wallet

#### Returns

`Promise`\<`void`\>

#### Throws

If connection fails

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Defined in: packages/types/dist/index.d.ts:2354

Disconnect from the wallet

#### Returns

`Promise`\<`void`\>

***

### isConnected()

> **isConnected**(): `boolean`

Defined in: packages/types/dist/index.d.ts:2358

Check if wallet is connected

#### Returns

`boolean`

***

### signMessage()

> **signMessage**(`message`): `Promise`\<[`Signature`](Signature.md)\>

Defined in: packages/types/dist/index.d.ts:2366

Sign an arbitrary message

#### Parameters

##### message

`Uint8Array`

The message bytes to sign

#### Returns

`Promise`\<[`Signature`](Signature.md)\>

The signature

#### Throws

If signing fails or wallet not connected

***

### signTransaction()

> **signTransaction**(`tx`): `Promise`\<[`SignedTransaction`](SignedTransaction.md)\>

Defined in: packages/types/dist/index.d.ts:2374

Sign a transaction

#### Parameters

##### tx

[`UnsignedTransaction`](UnsignedTransaction.md)

The unsigned transaction

#### Returns

`Promise`\<[`SignedTransaction`](SignedTransaction.md)\>

The signed transaction

#### Throws

If signing fails or wallet not connected

***

### signAndSendTransaction()

> **signAndSendTransaction**(`tx`): `Promise`\<[`TransactionReceipt`](TransactionReceipt.md)\>

Defined in: packages/types/dist/index.d.ts:2382

Sign and broadcast a transaction

#### Parameters

##### tx

[`UnsignedTransaction`](UnsignedTransaction.md)

The unsigned transaction

#### Returns

`Promise`\<[`TransactionReceipt`](TransactionReceipt.md)\>

The transaction receipt

#### Throws

If signing or broadcast fails

***

### getBalance()

> **getBalance**(): `Promise`\<`bigint`\>

Defined in: packages/types/dist/index.d.ts:2389

Get native token balance

#### Returns

`Promise`\<`bigint`\>

Balance in smallest unit (lamports, wei, etc.)

#### Throws

If query fails

***

### getTokenBalance()

> **getTokenBalance**(`asset`): `Promise`\<`bigint`\>

Defined in: packages/types/dist/index.d.ts:2397

Get token balance for a specific asset

#### Parameters

##### asset

[`Asset`](Asset.md)

The asset to query balance for

#### Returns

`Promise`\<`bigint`\>

Balance in smallest unit

#### Throws

If query fails or asset not supported

***

### on()

> **on**\<`T`\>(`event`, `handler`): `void`

Defined in: packages/types/dist/index.d.ts:2404

Subscribe to wallet events

#### Type Parameters

##### T

`T` *extends* [`WalletEventType`](../type-aliases/WalletEventType.md)

#### Parameters

##### event

`T`

Event type to subscribe to

##### handler

[`WalletEventHandler`](../type-aliases/WalletEventHandler.md)\<`Extract`\<[`WalletConnectEvent`](WalletConnectEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletDisconnectEvent`](WalletDisconnectEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletAccountChangedEvent`](WalletAccountChangedEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletChainChangedEvent`](WalletChainChangedEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletErrorEvent`](WalletErrorEvent.md), \{ `type`: `T`; \}\>\>

Event handler function

#### Returns

`void`

***

### off()

> **off**\<`T`\>(`event`, `handler`): `void`

Defined in: packages/types/dist/index.d.ts:2413

Unsubscribe from wallet events

#### Type Parameters

##### T

`T` *extends* [`WalletEventType`](../type-aliases/WalletEventType.md)

#### Parameters

##### event

`T`

Event type to unsubscribe from

##### handler

[`WalletEventHandler`](../type-aliases/WalletEventHandler.md)\<`Extract`\<[`WalletConnectEvent`](WalletConnectEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletDisconnectEvent`](WalletDisconnectEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletAccountChangedEvent`](WalletAccountChangedEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletChainChangedEvent`](WalletChainChangedEvent.md), \{ `type`: `T`; \}\> \| `Extract`\<[`WalletErrorEvent`](WalletErrorEvent.md), \{ `type`: `T`; \}\>\>

Event handler to remove

#### Returns

`void`
