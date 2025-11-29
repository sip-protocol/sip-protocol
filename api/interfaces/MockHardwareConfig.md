[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / MockHardwareConfig

# Interface: MockHardwareConfig

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:38](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L38)

Mock hardware wallet configuration

## Extends

- [`HardwareWalletConfig`](HardwareWalletConfig.md)

## Properties

### deviceType

> **deviceType**: [`HardwareWalletType`](../type-aliases/HardwareWalletType.md)

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:40](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L40)

Device type to simulate

***

### model?

> `optional` **model**: [`LedgerModel`](../type-aliases/LedgerModel.md) \| [`TrezorModel`](../type-aliases/TrezorModel.md)

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:42](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L42)

Device model

***

### isLocked?

> `optional` **isLocked**: `boolean`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:44](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L44)

Simulate device locked state

***

### signingDelay?

> `optional` **signingDelay**: `number`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:46](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L46)

Simulate signing delay (ms)

***

### shouldReject?

> `optional` **shouldReject**: `boolean`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:48](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L48)

Simulate user rejection

***

### shouldFailConnect?

> `optional` **shouldFailConnect**: `boolean`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:50](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L50)

Simulate connection failure

***

### mockAddress?

> `optional` **mockAddress**: `string`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:52](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L52)

Mock address to return

***

### mockPublicKey?

> `optional` **mockPublicKey**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:54](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L54)

Mock public key to return

***

### accountCount?

> `optional` **accountCount**: `number`

Defined in: [packages/sdk/src/wallet/hardware/mock.ts:56](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/mock.ts#L56)

Number of accounts available

***

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
