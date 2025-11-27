[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ShieldedBalance

# Interface: ShieldedBalance

Defined in: [packages/sdk/src/zcash/shielded-service.ts:124](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L124)

Shielded balance summary

## Properties

### confirmed

> **confirmed**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:126](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L126)

Total confirmed balance in ZEC

***

### unconfirmed

> **unconfirmed**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:128](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L128)

Total unconfirmed balance in ZEC

***

### pools

> **pools**: `object`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:130](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L130)

Balance by pool

#### transparent

> **transparent**: `number`

#### sapling

> **sapling**: `number`

#### orchard

> **orchard**: `number`

***

### spendableNotes

> **spendableNotes**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:136](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L136)

Number of spendable notes
