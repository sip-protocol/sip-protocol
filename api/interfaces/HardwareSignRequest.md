[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / HardwareSignRequest

# Interface: HardwareSignRequest

Defined in: [packages/sdk/src/wallet/hardware/types.ts:149](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L149)

Hardware wallet signing request

## Properties

### message

> **message**: `Uint8Array`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:151](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L151)

Raw message to sign

***

### displayMessage?

> `optional` **displayMessage**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:153](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L153)

Display message on device (if supported)

***

### isTransaction?

> `optional` **isTransaction**: `boolean`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:155](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L155)

Whether this is a transaction (vs arbitrary message)
