[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / LedgerWalletAdapter

# Class: LedgerWalletAdapter

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:61](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L61)

Ledger wallet adapter

Supports Ethereum and Solana chains via Ledger device apps.

## Extends

- [`BaseWalletAdapter`](BaseWalletAdapter.md)

## Constructors

### Constructor

> **new LedgerWalletAdapter**(`config`): `LedgerWalletAdapter`

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:72](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L72)

#### Parameters

##### config

[`LedgerConfig`](../interfaces/LedgerConfig.md)

#### Returns

`LedgerWalletAdapter`

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`constructor`](BaseWalletAdapter.md#constructor)

## Properties

### chain

> `readonly` **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:62](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L62)

Chain this adapter connects to

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`chain`](BaseWalletAdapter.md#chain)

***

### name

> `readonly` **name**: `string` = `'ledger'`

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:63](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L63)

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

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:87](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L87)

Get device information

##### Returns

[`HardwareDeviceInfo`](../interfaces/HardwareDeviceInfo.md) \| `null`

***

### derivationPath

#### Get Signature

> **get** **derivationPath**(): `string`

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:94](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L94)

Get current derivation path

##### Returns

`string`

***

### account

#### Get Signature

> **get** **account**(): [`HardwareAccount`](../interfaces/HardwareAccount.md) \| `null`

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:101](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L101)

Get current account

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

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:108](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L108)

Connect to Ledger device

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`connect`](BaseWalletAdapter.md#connect)

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:150](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L150)

Disconnect from Ledger device

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`disconnect`](BaseWalletAdapter.md#disconnect)

***

### signMessage()

> **signMessage**(`message`): `Promise`\<[`Signature`](../interfaces/Signature.md)\>

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:164](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L164)

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

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:190](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L190)

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

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:225](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L225)

Sign and send transaction

Note: Hardware wallets can only sign, not send. This returns a signed
transaction that must be broadcast separately.

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

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:242](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L242)

Get native token balance

Note: Hardware wallets don't track balances - this requires RPC.

#### Returns

`Promise`\<`bigint`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`getBalance`](BaseWalletAdapter.md#getbalance)

***

### getTokenBalance()

> **getTokenBalance**(`_asset`): `Promise`\<`bigint`\>

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:254](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L254)

Get token balance

Note: Hardware wallets don't track balances - this requires RPC.

#### Parameters

##### \_asset

[`Asset`](../interfaces/Asset.md)

#### Returns

`Promise`\<`bigint`\>

#### Overrides

[`BaseWalletAdapter`](BaseWalletAdapter.md).[`getTokenBalance`](BaseWalletAdapter.md#gettokenbalance)

***

### getAccounts()

> **getAccounts**(`startIndex`, `count`): `Promise`\<[`HardwareAccount`](../interfaces/HardwareAccount.md)[]\>

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:266](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L266)

Get multiple accounts from device

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

Defined in: [packages/sdk/src/wallet/hardware/ledger.ts:283](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/ledger.ts#L283)

Switch to different account index

#### Parameters

##### accountIndex

`number`

#### Returns

`Promise`\<[`HardwareAccount`](../interfaces/HardwareAccount.md)\>
