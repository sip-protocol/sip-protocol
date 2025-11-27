[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ReceivedNote

# Interface: ReceivedNote

Defined in: [packages/sdk/src/zcash/shielded-service.ts:102](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L102)

Received note information

## Properties

### txid

> **txid**: `string`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:104](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L104)

Transaction ID

***

### amount

> **amount**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:106](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L106)

Amount received

***

### memo?

> `optional` **memo**: `string`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:108](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L108)

Memo content (if any)

***

### confirmations

> **confirmations**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:110](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L110)

Number of confirmations

***

### spendable

> **spendable**: `boolean`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:112](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L112)

Whether spendable

***

### pool

> **pool**: `"sapling"` \| `"orchard"`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:114](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L114)

Pool type (sapling/orchard)

***

### address

> **address**: `string`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:116](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L116)

Receiving address

***

### isChange

> **isChange**: `boolean`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:118](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L118)

Whether this is change
