[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / EthereumAdapterConfig

# Interface: EthereumAdapterConfig

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:234](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L234)

Ethereum adapter configuration

## Properties

### wallet?

> `optional` **wallet**: [`EthereumWalletName`](../type-aliases/EthereumWalletName.md)

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:236](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L236)

Wallet to connect to

***

### chainId?

> `optional` **chainId**: `number`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:238](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L238)

Target chain ID

***

### rpcEndpoint?

> `optional` **rpcEndpoint**: `string`

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:240](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L240)

RPC endpoint URL (for balance queries)

***

### provider?

> `optional` **provider**: [`EIP1193Provider`](EIP1193Provider.md)

Defined in: [packages/sdk/src/wallet/ethereum/types.ts:242](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/ethereum/types.ts#L242)

Custom provider (for testing)
