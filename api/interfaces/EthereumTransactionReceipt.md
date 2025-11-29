[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / EthereumTransactionReceipt

# Interface: EthereumTransactionReceipt

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:143](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L143)

Ethereum transaction receipt

## Properties

### transactionHash

> **transactionHash**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:145](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L145)

Transaction hash

***

### blockNumber

> **blockNumber**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:147](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L147)

Block number

***

### blockHash

> **blockHash**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:149](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L149)

Block hash

***

### from

> **from**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:151](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L151)

Sender address

***

### to

> **to**: `string` \| `null`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:153](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L153)

Recipient address

***

### gasUsed

> **gasUsed**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:155](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L155)

Gas used

***

### effectiveGasPrice

> **effectiveGasPrice**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:157](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L157)

Effective gas price

***

### status

> **status**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:159](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L159)

Status (1 = success, 0 = failure)

***

### contractAddress

> **contractAddress**: `string` \| `null`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:161](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L161)

Contract address (if deployment)
