[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / createWalletFactory

# Function: createWalletFactory()

> **createWalletFactory**\<`T`\>(`AdapterClass`): [`WalletAdapterFactory`](../type-aliases/WalletAdapterFactory.md)

Defined in: [packages/sdk/src/wallet/registry.ts:191](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/wallet/registry.ts#L191)

Helper to create a wallet adapter factory

## Type Parameters

### T

`T` *extends* [`IWalletAdapter`](../interfaces/IWalletAdapter.md) \| [`PrivateWalletAdapter`](../interfaces/PrivateWalletAdapter.md)

## Parameters

### AdapterClass

() => `T`

## Returns

[`WalletAdapterFactory`](../type-aliases/WalletAdapterFactory.md)
