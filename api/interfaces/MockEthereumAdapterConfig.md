[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / MockEthereumAdapterConfig

# Interface: MockEthereumAdapterConfig

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:32](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/mock.ts#L32)

Mock Ethereum adapter configuration

## Properties

### address?

> `optional` **address**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:34](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/mock.ts#L34)

Mock address

***

### chainId?

> `optional` **chainId**: `number`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:36](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/mock.ts#L36)

Mock chain ID

***

### balance?

> `optional` **balance**: `bigint`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:38](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/mock.ts#L38)

Initial ETH balance in wei

***

### tokenBalances?

> `optional` **tokenBalances**: `Record`\<`string`, `bigint`\>

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:40](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/mock.ts#L40)

Token balances by address

***

### shouldFailConnect?

> `optional` **shouldFailConnect**: `boolean`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:42](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/mock.ts#L42)

Should connection fail

***

### shouldFailSign?

> `optional` **shouldFailSign**: `boolean`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:44](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/mock.ts#L44)

Should signing fail

***

### shouldFailTransaction?

> `optional` **shouldFailTransaction**: `boolean`

Defined in: [packages/sdk/src/wallet/ethereum/mock.ts:46](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/ethereum/mock.ts#L46)

Should transaction fail
