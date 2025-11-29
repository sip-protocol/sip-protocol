[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ShieldedSendResult

# Interface: ShieldedSendResult

Defined in: [packages/sdk/src/zcash/shielded-service.ts:82](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L82)

Result of a shielded send operation

## Properties

### txid

> **txid**: `string`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:84](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L84)

Transaction ID

***

### operationId

> **operationId**: `string`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:86](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L86)

Operation ID (for tracking)

***

### amount

> **amount**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:88](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L88)

Amount sent (excluding fee)

***

### fee

> **fee**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:90](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L90)

Fee paid

***

### to

> **to**: `string`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:92](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L92)

Recipient address

***

### from

> **from**: `string`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:94](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L94)

Sender address

***

### timestamp

> **timestamp**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:96](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L96)

Timestamp
