[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SolanaAdapterConfig

# Interface: SolanaAdapterConfig

Defined in: [packages/sdk/src/wallet/solana/types.ts:134](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L134)

Solana adapter configuration

## Properties

### wallet?

> `optional` **wallet**: [`SolanaWalletName`](../type-aliases/SolanaWalletName.md)

Defined in: [packages/sdk/src/wallet/solana/types.ts:136](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L136)

Wallet to connect to

***

### cluster?

> `optional` **cluster**: [`SolanaCluster`](../type-aliases/SolanaCluster.md)

Defined in: [packages/sdk/src/wallet/solana/types.ts:138](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L138)

Solana cluster/network

***

### rpcEndpoint?

> `optional` **rpcEndpoint**: `string`

Defined in: [packages/sdk/src/wallet/solana/types.ts:140](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L140)

RPC endpoint URL

***

### provider?

> `optional` **provider**: [`SolanaWalletProvider`](SolanaWalletProvider.md)

Defined in: [packages/sdk/src/wallet/solana/types.ts:142](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L142)

Custom wallet provider (for testing)

***

### connection?

> `optional` **connection**: [`SolanaConnection`](SolanaConnection.md)

Defined in: [packages/sdk/src/wallet/solana/types.ts:144](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L144)

Custom connection (for testing)
