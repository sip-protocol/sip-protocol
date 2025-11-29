[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / LedgerConfig

# Interface: LedgerConfig

Defined in: [packages/sdk/src/wallet/hardware/types.ts:121](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L121)

Ledger-specific configuration

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

### appName?

> `optional` **appName**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:123](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L123)

Expected app name to be open on device

***

### useLedgerLive?

> `optional` **useLedgerLive**: `boolean`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:125](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L125)

Whether to use Ledger Live derivation path

***

### scrambleKey?

> `optional` **scrambleKey**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:127](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L127)

Scramble key for transport
