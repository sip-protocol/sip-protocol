[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / HardwareTransport

# Interface: HardwareTransport

Defined in: [packages/sdk/src/wallet/hardware/types.ts:224](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L224)

Abstract transport interface for hardware communication

This is implemented by actual transport libraries:
- @ledgerhq/hw-transport-webusb
- @ledgerhq/hw-transport-webhid
- @trezor/connect-web

## Properties

### isOpen?

> `optional` **isOpen**: `boolean`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:232](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L232)

Check if transport is open

## Methods

### open()

> **open**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/hardware/types.ts:226](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L226)

Open connection to device

#### Returns

`Promise`\<`void`\>

***

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/wallet/hardware/types.ts:228](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L228)

Close connection

#### Returns

`Promise`\<`void`\>

***

### send()?

> `optional` **send**(`cla`, `ins`, `p1`, `p2`, `data?`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [packages/sdk/src/wallet/hardware/types.ts:230](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L230)

Send APDU command (Ledger)

#### Parameters

##### cla

`number`

##### ins

`number`

##### p1

`number`

##### p2

`number`

##### data?

`Buffer`\<`ArrayBufferLike`\>

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>
