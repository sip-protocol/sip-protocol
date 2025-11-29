[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / MockTrezorAdapter

# Class: MockTrezorAdapter

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:391](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L391)

Mock Trezor adapter for testing

## Extends

- [`BaseWalletAdapter`](BaseWalletAdapter.md)

## Constructors

### Constructor

> **new MockTrezorAdapter**(`config`): `MockTrezorAdapter`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:401](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L401)

#### Parameters

##### config

[`MockHardwareConfig`](../interfaces/MockHardwareConfig.md)

#### Returns

`MockTrezorAdapter`

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`constructor`](BaseWalletAdapter.md#constructor)

## Properties

### chain

> `readonly` **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:392](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L392)

Chain this adapter connects to

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`chain`](BaseWalletAdapter.md#chain)

***

### name

> `readonly` **name**: `string` = `'mock-trezor'`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:393](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L393)

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

***

### deviceInfo

#### Get Signature

> **get** **deviceInfo**(): [`HardwareDeviceInfo`](../interfaces/HardwareDeviceInfo.md) \| `null`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:420](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L420)

##### Returns

[`HardwareDeviceInfo`](../interfaces/HardwareDeviceInfo.md) \| `null`

***

### derivationPath

#### Get Signature

> **get** **derivationPath**(): `string`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:424](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L424)

##### Returns

`string`

***

### account

#### Get Signature

> **get** **account**(): [`HardwareAccount`](../interfaces/HardwareAccount.md) \| `null`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:428](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L428)

##### Returns

[`HardwareAccount`](../interfaces/HardwareAccount.md) \| `null`

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

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:432](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L432)

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

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:469](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L469)

Disconnect from the wallet

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`disconnect`](BaseWalletAdapter.md#disconnect)

***

### signMessage()

> **signMessage**(`message`): `Promise`\<[`Signature`](../interfaces/Signature.md)\>

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:475](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L475)

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

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:496](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L496)

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

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:525](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L525)

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

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:534](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L534)

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

> **getTokenBalance**(`_asset`): `Promise`\<`bigint`\>

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:541](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L541)

Get token balance for a specific asset

#### Parameters

##### \_asset

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

### getAccounts()

> **getAccounts**(`startIndex`, `count`): `Promise`\<[`HardwareAccount`](../interfaces/HardwareAccount.md)[]\>

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:548](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L548)

#### Parameters

##### startIndex

`number` = `0`

##### count

`number` = `5`

#### Returns

`Promise`\<[`HardwareAccount`](../interfaces/HardwareAccount.md)[]\>

***

### switchAccount()

> **switchAccount**(`accountIndex`): `Promise`\<[`HardwareAccount`](../interfaces/HardwareAccount.md)\>

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:553](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L553)

#### Parameters

##### accountIndex

`number`

#### Returns

`Promise`\<[`HardwareAccount`](../interfaces/HardwareAccount.md)\>

***

### setShouldReject()

> **setShouldReject**(`shouldReject`): `void`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:577](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L577)

#### Parameters

##### shouldReject

`boolean`

#### Returns

`void`

***

### setSigningDelay()

> **setSigningDelay**(`delay`): `void`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:581](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L581)

#### Parameters

##### delay

`number`

#### Returns

`void`

***

### simulateLock()

> **simulateLock**(): `void`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:585](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L585)

#### Returns

`void`

***

### simulateUnlock()

> **simulateUnlock**(): `void`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:592](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L592)

#### Returns

`void`
