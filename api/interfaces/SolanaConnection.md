[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SolanaConnection

# Interface: SolanaConnection

Defined in: [packages/sdk/src/wallet/solana/types.ts:58](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L58)

Solana connection interface for RPC calls

## Methods

### getBalance()

> **getBalance**(`publicKey`): `Promise`\<`number`\>

Defined in: [packages/sdk/src/wallet/solana/types.ts:60](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L60)

Get account balance in lamports

#### Parameters

##### publicKey

[`SolanaPublicKey`](SolanaPublicKey.md)

#### Returns

`Promise`\<`number`\>

***

### getTokenAccountBalance()

> **getTokenAccountBalance**(`publicKey`): `Promise`\<\{ `value`: \{ `amount`: `string`; `decimals`: `number`; \}; \}\>

Defined in: [packages/sdk/src/wallet/solana/types.ts:62](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L62)

Get token account balance

#### Parameters

##### publicKey

[`SolanaPublicKey`](SolanaPublicKey.md)

#### Returns

`Promise`\<\{ `value`: \{ `amount`: `string`; `decimals`: `number`; \}; \}\>

***

### getLatestBlockhash()

> **getLatestBlockhash**(): `Promise`\<\{ `blockhash`: `string`; `lastValidBlockHeight`: `number`; \}\>

Defined in: [packages/sdk/src/wallet/solana/types.ts:66](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L66)

Get latest blockhash

#### Returns

`Promise`\<\{ `blockhash`: `string`; `lastValidBlockHeight`: `number`; \}\>

***

### sendRawTransaction()

> **sendRawTransaction**(`rawTransaction`, `options?`): `Promise`\<`string`\>

Defined in: [packages/sdk/src/wallet/solana/types.ts:71](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L71)

Send raw transaction

#### Parameters

##### rawTransaction

`Uint8Array`

##### options?

[`SolanaSendOptions`](SolanaSendOptions.md)

#### Returns

`Promise`\<`string`\>

***

### confirmTransaction()

> **confirmTransaction**(`signature`, `commitment?`): `Promise`\<\{ `value`: \{ `err`: `unknown`; \}; \}\>

Defined in: [packages/sdk/src/wallet/solana/types.ts:76](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L76)

Confirm transaction

#### Parameters

##### signature

`string`

##### commitment?

`"confirmed"` | `"processed"` | `"finalized"`

#### Returns

`Promise`\<\{ `value`: \{ `err`: `unknown`; \}; \}\>
