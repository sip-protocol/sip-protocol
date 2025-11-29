[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / HardwareSignature

# Interface: HardwareSignature

Defined in: [packages/sdk/src/wallet/hardware/types.ts:185](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L185)

Signature from hardware wallet

## Properties

### r

> **r**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/hardware/types.ts:187](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L187)

r component

***

### s

> **s**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/hardware/types.ts:189](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L189)

s component

***

### v

> **v**: `number`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:191](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L191)

v component (recovery id)

***

### signature

> **signature**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/hardware/types.ts:193](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L193)

Full signature (r + s + v)
