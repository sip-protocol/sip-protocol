[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashShieldedService

# Class: ZcashShieldedService

Defined in: [packages/sdk/src/zcash/shielded-service.ts:161](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L161)

Zcash Shielded Transaction Service

Provides high-level operations for Zcash shielded transactions
with SIP Protocol integration.

## Constructors

### Constructor

> **new ZcashShieldedService**(`config`): `ZcashShieldedService`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:168](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L168)

#### Parameters

##### config

[`ZcashShieldedServiceConfig`](../interfaces/ZcashShieldedServiceConfig.md)

#### Returns

`ZcashShieldedService`

## Accessors

### rpcClient

#### Get Signature

> **get** **rpcClient**(): [`ZcashRPCClient`](ZcashRPCClient.md)

Defined in: [packages/sdk/src/zcash/shielded-service.ts:680](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L680)

Get underlying RPC client for advanced operations

##### Returns

[`ZcashRPCClient`](ZcashRPCClient.md)

***

### currentAccount

#### Get Signature

> **get** **currentAccount**(): `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:687](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L687)

Get current account number

##### Returns

`number`

## Methods

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:186](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L186)

Initialize the service

Creates an account if needed and retrieves the default address.

#### Returns

`Promise`\<`void`\>

***

### getAddress()

> **getAddress**(): `string`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:228](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L228)

Get the default shielded address

#### Returns

`string`

***

### generateNewAddress()

> **generateNewAddress**(): `Promise`\<`string`\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:238](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L238)

Generate a new diversified address for the account

Each address is unlinkable but controlled by the same account.

#### Returns

`Promise`\<`string`\>

***

### validateAddress()

> **validateAddress**(`address`): `Promise`\<[`ZcashAddressInfo`](../interfaces/ZcashAddressInfo.md)\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:247](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L247)

Validate an address

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`ZcashAddressInfo`](../interfaces/ZcashAddressInfo.md)\>

***

### isShieldedAddress()

> **isShieldedAddress**(`address`): `Promise`\<`boolean`\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:254](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L254)

Check if an address is a shielded address

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`boolean`\>

***

### getBalance()

> **getBalance**(`minConf?`): `Promise`\<[`ShieldedBalance`](../interfaces/ShieldedBalance.md)\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:267](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L267)

Get shielded balance summary

#### Parameters

##### minConf?

`number`

#### Returns

`Promise`\<[`ShieldedBalance`](../interfaces/ShieldedBalance.md)\>

***

### sendShielded()

> **sendShielded**(`params`): `Promise`\<[`ShieldedSendResult`](../interfaces/ShieldedSendResult.md)\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:306](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L306)

Send a shielded transaction

#### Parameters

##### params

[`ShieldedSendParams`](../interfaces/ShieldedSendParams.md)

Send parameters

#### Returns

`Promise`\<[`ShieldedSendResult`](../interfaces/ShieldedSendResult.md)\>

Send result with txid

***

### sendWithPrivacy()

> **sendWithPrivacy**(`to`, `amount`, `privacyLevel`, `memo?`): `Promise`\<[`ShieldedSendResult`](../interfaces/ShieldedSendResult.md)\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:391](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L391)

Send shielded transaction with SIP integration

Higher-level method that handles privacy level mapping.

#### Parameters

##### to

`string`

##### amount

`number`

##### privacyLevel

[`PrivacyLevel`](../enumerations/PrivacyLevel.md)

##### memo?

`string`

#### Returns

`Promise`\<[`ShieldedSendResult`](../interfaces/ShieldedSendResult.md)\>

***

### getReceivedNotes()

> **getReceivedNotes**(`minConf?`, `onlySpendable?`): `Promise`\<[`ReceivedNote`](../interfaces/ReceivedNote.md)[]\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:423](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L423)

Get received notes (incoming shielded transactions)

#### Parameters

##### minConf?

`number`

Minimum confirmations

##### onlySpendable?

`boolean` = `false`

Only return spendable notes

#### Returns

`Promise`\<[`ReceivedNote`](../interfaces/ReceivedNote.md)[]\>

***

### getPendingNotes()

> **getPendingNotes**(): `Promise`\<[`ReceivedNote`](../interfaces/ReceivedNote.md)[]\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:441](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L441)

Get pending (unconfirmed) incoming transactions

#### Returns

`Promise`\<[`ReceivedNote`](../interfaces/ReceivedNote.md)[]\>

***

### waitForNote()

> **waitForNote**(`predicate`, `timeout`, `pollInterval`): `Promise`\<[`ReceivedNote`](../interfaces/ReceivedNote.md)\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:453](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L453)

Wait for incoming note with specific criteria

#### Parameters

##### predicate

(`note`) => `boolean`

Function to match the expected note

##### timeout

`number` = `300000`

Timeout in ms

##### pollInterval

`number` = `5000`

Poll interval in ms

#### Returns

`Promise`\<[`ReceivedNote`](../interfaces/ReceivedNote.md)\>

***

### exportViewingKey()

> **exportViewingKey**(`address?`): `Promise`\<[`ExportedViewingKey`](../interfaces/ExportedViewingKey.md)\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:485](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L485)

Export viewing key for an address

The viewing key allows monitoring incoming transactions
without spending capability.

#### Parameters

##### address?

`string`

#### Returns

`Promise`\<[`ExportedViewingKey`](../interfaces/ExportedViewingKey.md)\>

***

### importViewingKey()

> **importViewingKey**(`viewingKey`, `rescan`, `startHeight?`): `Promise`\<`void`\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:504](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L504)

Import viewing key for monitoring

Allows monitoring transactions to an address without spending.

#### Parameters

##### viewingKey

`string`

##### rescan

`"yes"` | `"no"` | `"whenkeyisnew"`

##### startHeight?

`number`

#### Returns

`Promise`\<`void`\>

***

### exportForCompliance()

> **exportForCompliance**(): `Promise`\<\{ `viewingKey`: [`ExportedViewingKey`](../interfaces/ExportedViewingKey.md); `privacyLevel`: [`PrivacyLevel`](../enumerations/PrivacyLevel.md); `disclaimer`: `string`; \}\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:517](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L517)

Export viewing key for compliance/audit

Specifically for SIP COMPLIANT privacy level.

#### Returns

`Promise`\<\{ `viewingKey`: [`ExportedViewingKey`](../interfaces/ExportedViewingKey.md); `privacyLevel`: [`PrivacyLevel`](../enumerations/PrivacyLevel.md); `disclaimer`: `string`; \}\>

***

### getOperationStatus()

> **getOperationStatus**(`operationId`): `Promise`\<[`ZcashOperation`](../interfaces/ZcashOperation.md) \| `null`\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:538](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L538)

Get status of an operation

#### Parameters

##### operationId

`string`

#### Returns

`Promise`\<[`ZcashOperation`](../interfaces/ZcashOperation.md) \| `null`\>

***

### listPendingOperations()

> **listPendingOperations**(): `Promise`\<[`ZcashOperation`](../interfaces/ZcashOperation.md)[]\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:546](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L546)

List all pending operations

#### Returns

`Promise`\<[`ZcashOperation`](../interfaces/ZcashOperation.md)[]\>

***

### getBlockHeight()

> **getBlockHeight**(): `Promise`\<`number`\>

Defined in: [packages/sdk/src/zcash/shielded-service.ts:556](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L556)

Get current block height

#### Returns

`Promise`\<`number`\>

***

### isTestnet()

> **isTestnet**(): `boolean`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:563](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L563)

Check if connected to testnet

#### Returns

`boolean`

***

### estimateFee()

> **estimateFee**(`recipients`, `inputs`): `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:602](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L602)

Estimate transaction fee based on ZIP-317 conventional fee

The ZIP-317 fee is calculated as:
fee = marginal_fee * max(grace_actions, logical_actions)

For shielded transactions:
- Each Sapling spend = 1 logical action
- Each Sapling output = 1 logical action
- Each Orchard action = 1 logical action (covers both spend and output)

#### Parameters

##### recipients

`number` = `1`

Number of recipients (outputs)

##### inputs

`number` = `1`

Estimated number of input notes (default: 1)

#### Returns

`number`

Estimated fee in ZEC

#### Example

```typescript
// Estimate fee for 1 recipient
const fee = service.estimateFee(1)

// Estimate fee for 3 recipients with 2 input notes
const fee = service.estimateFee(3, 2)
```

***

### getMinimumFee()

> **getMinimumFee**(): `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:618](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/shielded-service.ts#L618)

Get minimum fee for a shielded transaction

#### Returns

`number`

Minimum fee in ZEC (ZIP-317 with grace actions)
