[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SolanaWalletProvider

# Interface: SolanaWalletProvider

Defined in: [packages/sdk/src/wallet/solana/types.ts:86](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L86)

Injected Solana wallet provider interface
This is what Phantom/Solflare/etc inject into window

## Properties

### isPhantom?

> `optional` **isPhantom**: `boolean`

Defined in: [packages/sdk/src/wallet/solana/types.ts:88](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L88)

Provider is Phantom

***

### isSolflare?

> `optional` **isSolflare**: `boolean`

Defined in: [packages/sdk/src/wallet/solana/types.ts:90](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L90)

Provider is Solflare

***

### isBackpack?

> `optional` **isBackpack**: `boolean`

Defined in: [packages/sdk/src/wallet/solana/types.ts:92](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L92)

Provider is Backpack

***

### publicKey

> **publicKey**: [`SolanaPublicKey`](SolanaPublicKey.md) \| `null`

Defined in: [packages/sdk/src/wallet/solana/types.ts:94](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L94)

Public key when connected

***

### isConnected

> **isConnected**: `boolean`

Defined in: [packages/sdk/src/wallet/solana/types.ts:96](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L96)

Whether wallet is connected

## Methods

### connect()

> **connect**(`options?`): `Promise`\<\{ `publicKey`: [`SolanaPublicKey`](SolanaPublicKey.md); \}\>

Defined in: [packages/sdk/src/wallet/solana/types.ts:98](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L98)

Connect to wallet

#### Parameters

##### options?

###### onlyIfTrusted?

`boolean`

#### Returns

`Promise`\<\{ `publicKey`: [`SolanaPublicKey`](SolanaPublicKey.md); \}\>

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/solana/types.ts:100](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L100)

Disconnect from wallet

#### Returns

`Promise`\<`void`\>

***

### signMessage()

> **signMessage**(`message`, `encoding?`): `Promise`\<\{ `signature`: `Uint8Array`; \}\>

Defined in: [packages/sdk/src/wallet/solana/types.ts:102](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L102)

Sign a message

#### Parameters

##### message

`Uint8Array`

##### encoding?

`"utf8"`

#### Returns

`Promise`\<\{ `signature`: `Uint8Array`; \}\>

***

### signTransaction()

> **signTransaction**\<`T`\>(`transaction`): `Promise`\<`T`\>

Defined in: [packages/sdk/src/wallet/solana/types.ts:104](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L104)

Sign a transaction

#### Type Parameters

##### T

`T` *extends* [`SolanaTransaction`](SolanaTransaction.md) \| [`SolanaVersionedTransaction`](SolanaVersionedTransaction.md)

#### Parameters

##### transaction

`T`

#### Returns

`Promise`\<`T`\>

***

### signAllTransactions()

> **signAllTransactions**\<`T`\>(`transactions`): `Promise`\<`T`[]\>

Defined in: [packages/sdk/src/wallet/solana/types.ts:108](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L108)

Sign multiple transactions

#### Type Parameters

##### T

`T` *extends* [`SolanaTransaction`](SolanaTransaction.md) \| [`SolanaVersionedTransaction`](SolanaVersionedTransaction.md)

#### Parameters

##### transactions

`T`[]

#### Returns

`Promise`\<`T`[]\>

***

### signAndSendTransaction()

> **signAndSendTransaction**\<`T`\>(`transaction`, `options?`): `Promise`\<\{ `signature`: `string`; \}\>

Defined in: [packages/sdk/src/wallet/solana/types.ts:112](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L112)

Sign and send transaction

#### Type Parameters

##### T

`T` *extends* [`SolanaTransaction`](SolanaTransaction.md) \| [`SolanaVersionedTransaction`](SolanaVersionedTransaction.md)

#### Parameters

##### transaction

`T`

##### options?

[`SolanaSendOptions`](SolanaSendOptions.md)

#### Returns

`Promise`\<\{ `signature`: `string`; \}\>

***

### on()

> **on**(`event`, `handler`): `void`

Defined in: [packages/sdk/src/wallet/solana/types.ts:117](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L117)

Event handling

#### Parameters

##### event

`"connect"` | `"disconnect"` | `"accountChanged"`

##### handler

(...`args`) => `void`

#### Returns

`void`

***

### off()

> **off**(`event`, `handler`): `void`

Defined in: [packages/sdk/src/wallet/solana/types.ts:118](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/solana/types.ts#L118)

#### Parameters

##### event

`"connect"` | `"disconnect"` | `"accountChanged"`

##### handler

(...`args`) => `void`

#### Returns

`void`
