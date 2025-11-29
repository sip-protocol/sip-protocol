[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / MockSolanaAdapterConfig

# Interface: MockSolanaAdapterConfig

Defined in: [packages/sdk/src/wallet/solana/mock.ts:86](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/mock.ts#L86)

Configuration for mock Solana adapter

## Properties

### address?

> `optional` **address**: `string`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:88](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/mock.ts#L88)

Mock address (base58)

***

### balance?

> `optional` **balance**: `bigint`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:90](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/mock.ts#L90)

Mock balance in lamports

***

### tokenBalances?

> `optional` **tokenBalances**: `Record`\<`string`, `bigint`\>

Defined in: [packages/sdk/src/wallet/solana/mock.ts:92](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/mock.ts#L92)

Token balances by mint address

***

### shouldFailConnect?

> `optional` **shouldFailConnect**: `boolean`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:94](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/mock.ts#L94)

Whether to simulate connection failure

***

### shouldFailSign?

> `optional` **shouldFailSign**: `boolean`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:96](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/mock.ts#L96)

Whether to simulate signing failure

***

### shouldFailTransaction?

> `optional` **shouldFailTransaction**: `boolean`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:98](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/mock.ts#L98)

Whether to simulate transaction failure

***

### cluster?

> `optional` **cluster**: [`SolanaCluster`](../type-aliases/SolanaCluster.md)

Defined in: [packages/sdk/src/wallet/solana/mock.ts:100](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/mock.ts#L100)

Simulated cluster

***

### latency?

> `optional` **latency**: `number`

Defined in: [packages/sdk/src/wallet/solana/mock.ts:102](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/mock.ts#L102)

Simulated latency in ms
