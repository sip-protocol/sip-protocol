[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SolanaUnsignedTransaction

# Interface: SolanaUnsignedTransaction

Defined in: [packages/sdk/src/wallet/solana/types.ts:150](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L150)

Solana-specific unsigned transaction

## Properties

### transaction

> **transaction**: [`SolanaTransaction`](SolanaTransaction.md) \| [`SolanaVersionedTransaction`](SolanaVersionedTransaction.md)

Defined in: [packages/sdk/src/wallet/solana/types.ts:152](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L152)

The Solana transaction object

***

### isVersioned?

> `optional` **isVersioned**: `boolean`

Defined in: [packages/sdk/src/wallet/solana/types.ts:154](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L154)

Whether this is a versioned transaction

***

### sendOptions?

> `optional` **sendOptions**: [`SolanaSendOptions`](SolanaSendOptions.md)

Defined in: [packages/sdk/src/wallet/solana/types.ts:156](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L156)

Send options
