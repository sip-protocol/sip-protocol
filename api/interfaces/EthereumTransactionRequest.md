[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / EthereumTransactionRequest

# Interface: EthereumTransactionRequest

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:117](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L117)

Ethereum transaction request

## Properties

### from?

> `optional` **from**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:119](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L119)

Sender address

***

### to?

> `optional` **to**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:121](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L121)

Recipient address

***

### value?

> `optional` **value**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:123](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L123)

Value in wei (hex)

***

### data?

> `optional` **data**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:125](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L125)

Transaction data (hex)

***

### gas?

> `optional` **gas**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:127](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L127)

Gas limit (hex)

***

### gasPrice?

> `optional` **gasPrice**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:129](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L129)

Gas price (hex) - legacy

***

### maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:131](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L131)

Max fee per gas (hex) - EIP-1559

***

### maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:133](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L133)

Max priority fee per gas (hex) - EIP-1559

***

### nonce?

> `optional` **nonce**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:135](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L135)

Nonce (hex)

***

### chainId?

> `optional` **chainId**: `number`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:137](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L137)

Chain ID
