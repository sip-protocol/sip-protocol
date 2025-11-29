[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / HardwareEthereumTx

# Interface: HardwareEthereumTx

Defined in: [packages/sdk/src/wallet/hardware/types.ts:161](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L161)

Ethereum transaction for hardware signing

## Properties

### to

> **to**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:163](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L163)

Recipient address

***

### value

> **value**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/hardware/types.ts:165](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L165)

Value in wei (hex)

***

### gasLimit

> **gasLimit**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/hardware/types.ts:167](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L167)

Gas limit (hex)

***

### gasPrice?

> `optional` **gasPrice**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/hardware/types.ts:169](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L169)

Gas price (hex) - for legacy tx

***

### maxFeePerGas?

> `optional` **maxFeePerGas**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/hardware/types.ts:171](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L171)

Max fee per gas (hex) - for EIP-1559

***

### maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/hardware/types.ts:173](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L173)

Max priority fee per gas (hex) - for EIP-1559

***

### data?

> `optional` **data**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/hardware/types.ts:175](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L175)

Transaction data (hex)

***

### nonce

> **nonce**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/hardware/types.ts:177](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L177)

Nonce (hex)

***

### chainId

> **chainId**: `number`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:179](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L179)

Chain ID
