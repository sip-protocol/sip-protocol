[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / PrivateWalletAdapter

# Interface: PrivateWalletAdapter

Defined in: packages/types/dist/index.d.ts:1639

Privacy-enhanced wallet adapter

Extends WalletAdapter with privacy features:
- Stealth address generation and scanning
- Viewing key export for compliance
- Shielded transaction support

## Example

```typescript
class ZcashPrivateWallet implements PrivateWalletAdapter {
  // ... WalletAdapter methods ...

  getStealthMetaAddress(): StealthMetaAddress {
    return this.stealthMeta
  }

  async shieldedSend(params: ShieldedSendParams): Promise<ShieldedSendResult> {
    // Use Zcash shielded pool
  }
}
```

## Extends

- [`IWalletAdapter`](IWalletAdapter.md)

## Properties

### chain

> `readonly` **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:1505

Chain this adapter connects to

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`chain`](IWalletAdapter.md#chain)

***

### name

> `readonly` **name**: `string`

Defined in: packages/types/dist/index.d.ts:1507

Wallet name/identifier (e.g., 'phantom', 'metamask')

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`name`](IWalletAdapter.md#name)

***

### address

> `readonly` **address**: `string`

Defined in: packages/types/dist/index.d.ts:1509

Current address (empty string if not connected)

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`address`](IWalletAdapter.md#address)

***

### publicKey

> `readonly` **publicKey**: `""` \| `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:1511

Public key (hex encoded, empty string if not connected)

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`publicKey`](IWalletAdapter.md#publickey)

***

### connectionState

> `readonly` **connectionState**: [`WalletConnectionState`](../type-aliases/WalletConnectionState.md)

Defined in: packages/types/dist/index.d.ts:1515

Current connection state

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`connectionState`](IWalletAdapter.md#connectionstate)

## Methods

### connect()

> **connect**(): `Promise`\<`void`\>

Defined in: packages/types/dist/index.d.ts:1521

Connect to the wallet

#### Returns

`Promise`\<`void`\>

#### Throws

If connection fails

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`connect`](IWalletAdapter.md#connect)

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Defined in: packages/types/dist/index.d.ts:1525

Disconnect from the wallet

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`disconnect`](IWalletAdapter.md#disconnect)

***

### isConnected()

> **isConnected**(): `boolean`

Defined in: packages/types/dist/index.d.ts:1529

Check if wallet is connected

#### Returns

`boolean`

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`isConnected`](IWalletAdapter.md#isconnected)

***

### signMessage()

> **signMessage**(`message`): `Promise`\<[`Signature`](Signature.md)\>

Defined in: packages/types/dist/index.d.ts:1537

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

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`signMessage`](IWalletAdapter.md#signmessage)

***

### signTransaction()

> **signTransaction**(`tx`): `Promise`\<[`SignedTransaction`](SignedTransaction.md)\>

Defined in: packages/types/dist/index.d.ts:1545

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

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`signTransaction`](IWalletAdapter.md#signtransaction)

***

### signAndSendTransaction()

> **signAndSendTransaction**(`tx`): `Promise`\<[`TransactionReceipt`](TransactionReceipt.md)\>

Defined in: packages/types/dist/index.d.ts:1553

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

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`signAndSendTransaction`](IWalletAdapter.md#signandsendtransaction)

***

### getBalance()

> **getBalance**(): `Promise`\<`bigint`\>

Defined in: packages/types/dist/index.d.ts:1560

Get native token balance

#### Returns

`Promise`\<`bigint`\>

Balance in smallest unit (lamports, wei, etc.)

#### Throws

If query fails

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`getBalance`](IWalletAdapter.md#getbalance)

***

### getTokenBalance()

> **getTokenBalance**(`asset`): `Promise`\<`bigint`\>

Defined in: packages/types/dist/index.d.ts:1568

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

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`getTokenBalance`](IWalletAdapter.md#gettokenbalance)

***

### on()

> **on**\<`T`\>(`event`, `handler`): `void`

Defined in: packages/types/dist/index.d.ts:1575

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

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`on`](IWalletAdapter.md#on)

***

### off()

> **off**\<`T`\>(`event`, `handler`): `void`

Defined in: packages/types/dist/index.d.ts:1584

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

#### Inherited from

[`IWalletAdapter`](IWalletAdapter.md).[`off`](IWalletAdapter.md#off)

***

### supportsStealthAddresses()

> **supportsStealthAddresses**(): `boolean`

Defined in: packages/types/dist/index.d.ts:1643

Check if wallet supports stealth addresses

#### Returns

`boolean`

***

### getStealthMetaAddress()

> **getStealthMetaAddress**(): [`StealthMetaAddress`](StealthMetaAddress.md)

Defined in: packages/types/dist/index.d.ts:1653

Get the stealth meta-address for receiving private payments

The meta-address contains spending and viewing public keys that senders
use to derive one-time stealth addresses.

#### Returns

[`StealthMetaAddress`](StealthMetaAddress.md)

The stealth meta-address

#### Throws

If stealth addresses not supported

***

### deriveStealthAddress()

> **deriveStealthAddress**(`ephemeralPubKey`): [`StealthAddress`](StealthAddress.md)

Defined in: packages/types/dist/index.d.ts:1662

Generate a one-time stealth address from an ephemeral public key

Used by senders to derive a unique receiving address.

#### Parameters

##### ephemeralPubKey

`` `0x${string}` ``

Sender's ephemeral public key

#### Returns

[`StealthAddress`](StealthAddress.md)

The derived stealth address

***

### checkStealthAddress()

> **checkStealthAddress**(`stealthAddress`, `ephemeralPubKey`): `boolean`

Defined in: packages/types/dist/index.d.ts:1670

Check if a stealth address belongs to this wallet

#### Parameters

##### stealthAddress

`` `0x${string}` ``

The address to check

##### ephemeralPubKey

`` `0x${string}` ``

The ephemeral public key used

#### Returns

`boolean`

True if this wallet can spend from the address

***

### scanStealthPayments()

> **scanStealthPayments**(`fromBlock?`, `toBlock?`): `Promise`\<`object`[]\>

Defined in: packages/types/dist/index.d.ts:1681

Scan for received stealth payments

Scans announcements/transactions to find payments to this wallet's
stealth addresses.

#### Parameters

##### fromBlock?

`bigint`

Optional starting block

##### toBlock?

`bigint`

Optional ending block

#### Returns

`Promise`\<`object`[]\>

Array of detected stealth addresses with amounts

***

### supportsViewingKeys()

> **supportsViewingKeys**(): `boolean`

Defined in: packages/types/dist/index.d.ts:1691

Check if wallet supports viewing key export

#### Returns

`boolean`

***

### exportViewingKey()

> **exportViewingKey**(): [`ViewingKey`](ViewingKey.md)

Defined in: packages/types/dist/index.d.ts:1701

Export viewing key for selective disclosure

Allows third parties (auditors, regulators) to view transaction
details without spending capability.

#### Returns

[`ViewingKey`](ViewingKey.md)

The viewing key

#### Throws

If viewing keys not supported

***

### supportsShieldedTransactions()

> **supportsShieldedTransactions**(): `boolean`

Defined in: packages/types/dist/index.d.ts:1705

Check if wallet supports shielded transactions

#### Returns

`boolean`

***

### getShieldedBalance()

> **getShieldedBalance**(): `Promise`\<`bigint`\>

Defined in: packages/types/dist/index.d.ts:1711

Get shielded balance (in shielded pools, if applicable)

#### Returns

`Promise`\<`bigint`\>

Shielded balance in smallest unit

***

### shieldedSend()

> **shieldedSend**(`params`): `Promise`\<[`WalletShieldedSendResult`](WalletShieldedSendResult.md)\>

Defined in: packages/types/dist/index.d.ts:1722

Send tokens with maximum privacy

Uses shielded pools and/or stealth addresses depending on
the target chain's capabilities.

#### Parameters

##### params

[`WalletShieldedSendParams`](WalletShieldedSendParams.md)

Shielded send parameters

#### Returns

`Promise`\<[`WalletShieldedSendResult`](WalletShieldedSendResult.md)\>

The transaction result

#### Throws

If shielded send fails
