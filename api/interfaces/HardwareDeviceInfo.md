[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / HardwareDeviceInfo

# Interface: HardwareDeviceInfo

Defined in: [packages/sdk/src/wallet/hardware/types.ts:47](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L47)

Hardware device information

## Properties

### manufacturer

> **manufacturer**: [`HardwareWalletType`](../type-aliases/HardwareWalletType.md)

Defined in: [packages/sdk/src/wallet/hardware/types.ts:49](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L49)

Device manufacturer

***

### model

> **model**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:51](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L51)

Device model

***

### firmwareVersion?

> `optional` **firmwareVersion**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:53](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L53)

Firmware version

***

### isLocked

> **isLocked**: `boolean`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:55](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L55)

Whether device is locked

***

### currentApp?

> `optional` **currentApp**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:57](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L57)

Currently open app (if any)

***

### label?

> `optional` **label**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:59](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L59)

Device label/name (user-set)

***

### deviceId?

> `optional` **deviceId**: `string`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:61](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L61)

Device ID (unique identifier)
