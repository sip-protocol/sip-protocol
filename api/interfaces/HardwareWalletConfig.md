[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / HardwareWalletConfig

# Interface: HardwareWalletConfig

Defined in: [packages/sdk/src/wallet/hardware/types.ts:105](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L105)

Base hardware wallet configuration

## Extended by

- [`LedgerConfig`](LedgerConfig.md)
- [`TrezorConfig`](TrezorConfig.md)
- [`MockHardwareConfig`](MockHardwareConfig.md)

## Properties

### chain

> **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: [packages/sdk/src/wallet/hardware/types.ts:107](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L107)

Target chain

***

### accountIndex?

> `optional` **accountIndex**: `number`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:109](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L109)

Account index (default: 0)

***

### derivationPath?

> `optional` **derivationPath**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:111](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L111)

Custom derivation path (overrides default)

***

### transport?

> `optional` **transport**: [`TransportType`](../type-aliases/TransportType.md)

Defined in: [packages/sdk/src/wallet/hardware/types.ts:113](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L113)

Transport type preference

***

### timeout?

> `optional` **timeout**: `number`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:115](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L115)

Connection timeout in ms (default: 30000)
