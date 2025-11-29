[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SolanaTransaction

# Interface: SolanaTransaction

Defined in: [packages/sdk/src/wallet/solana/types.ts:25](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L25)

Solana transaction interface
Matches @solana/web3.js Transaction

## Properties

### signature?

> `optional` **signature**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [packages/sdk/src/wallet/solana/types.ts:27](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L27)

Transaction signature after signing

## Methods

### serialize()

> **serialize**(): `Uint8Array`

Defined in: [packages/sdk/src/wallet/solana/types.ts:29](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L29)

Serialized transaction

#### Returns

`Uint8Array`

***

### addSignature()

> **addSignature**(`pubkey`, `signature`): `void`

Defined in: [packages/sdk/src/wallet/solana/types.ts:31](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L31)

Add signature to transaction

#### Parameters

##### pubkey

[`SolanaPublicKey`](SolanaPublicKey.md)

##### signature

`Uint8Array`

#### Returns

`void`
