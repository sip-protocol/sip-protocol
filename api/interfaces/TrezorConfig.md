[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / TrezorConfig

# Interface: TrezorConfig

Defined in: [packages/sdk/src/wallet/hardware/types.ts:133](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L133)

Trezor-specific configuration

## Extends

- [`HardwareWalletConfig`](HardwareWalletConfig.md)

## Properties

### chain

> **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: [packages/sdk/src/wallet/hardware/types.ts:107](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L107)

Target chain

#### Inherited from

[`HardwareWalletConfig`](HardwareWalletConfig.md).[`chain`](HardwareWalletConfig.md#chain)

***

### accountIndex?

> `optional` **accountIndex**: `number`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:109](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L109)

Account index (default: 0)

#### Inherited from

[`HardwareWalletConfig`](HardwareWalletConfig.md).[`accountIndex`](HardwareWalletConfig.md#accountindex)

***

### derivationPath?

> `optional` **derivationPath**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:111](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L111)

Custom derivation path (overrides default)

#### Inherited from

[`HardwareWalletConfig`](HardwareWalletConfig.md).[`derivationPath`](HardwareWalletConfig.md#derivationpath)

***

### transport?

> `optional` **transport**: [`TransportType`](../type-aliases/TransportType.md)

Defined in: [packages/sdk/src/wallet/hardware/types.ts:113](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L113)

Transport type preference

#### Inherited from

[`HardwareWalletConfig`](HardwareWalletConfig.md).[`transport`](HardwareWalletConfig.md#transport)

***

### timeout?

> `optional` **timeout**: `number`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:115](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L115)

Connection timeout in ms (default: 30000)

#### Inherited from

[`HardwareWalletConfig`](HardwareWalletConfig.md).[`timeout`](HardwareWalletConfig.md#timeout)

***

### manifestUrl?

> `optional` **manifestUrl**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:135](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L135)

Trezor Connect manifest URL

***

### manifestEmail?

> `optional` **manifestEmail**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:137](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L137)

Trezor Connect manifest email

***

### manifestAppName?

> `optional` **manifestAppName**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:139](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L139)

Trezor Connect manifest app name

***

### popup?

> `optional` **popup**: `boolean`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:141](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L141)

Whether to use popup for Trezor Connect
