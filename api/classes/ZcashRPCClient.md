[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashRPCClient

# Class: ZcashRPCClient

Defined in: [packages/sdk/src/zcash/rpc-client.ts:118](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L118)

Zcash RPC Client

Provides type-safe access to zcashd JSON-RPC API with automatic
retry logic and proper error handling.

## Security

IMPORTANT: Always use HTTPS in production environments.
This client uses HTTP Basic Authentication which transmits credentials
in base64-encoded cleartext. Without TLS/HTTPS, credentials and all
RPC data are vulnerable to network sniffing and man-in-the-middle attacks.

Production configuration should use:
- HTTPS endpoint (e.g., https://your-node.com:8232)
- Valid TLS certificates
- Secure credential storage
- Network-level access controls

## Constructors

### Constructor

> **new ZcashRPCClient**(`config`): `ZcashRPCClient`

Defined in: [packages/sdk/src/zcash/rpc-client.ts:123](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L123)

#### Parameters

##### config

[`ZcashConfig`](../interfaces/ZcashConfig.md)

#### Returns

`ZcashRPCClient`

## Accessors

### isTestnet

#### Get Signature

> **get** **isTestnet**(): `boolean`

Defined in: [packages/sdk/src/zcash/rpc-client.ts:579](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L579)

Check if client is configured for testnet

##### Returns

`boolean`

***

### endpoint

#### Get Signature

> **get** **endpoint**(): `string`

Defined in: [packages/sdk/src/zcash/rpc-client.ts:586](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L586)

Get the RPC endpoint URL

##### Returns

`string`

## Methods

### validateAddress()

> **validateAddress**(`address`): `Promise`\<[`ZcashAddressInfo`](../interfaces/ZcashAddressInfo.md)\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:149](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L149)

Validate a Zcash address

#### Parameters

##### address

`string`

Address to validate (t-addr, z-addr, or unified)

#### Returns

`Promise`\<[`ZcashAddressInfo`](../interfaces/ZcashAddressInfo.md)\>

Address validation info

***

### createAccount()

> **createAccount**(): `Promise`\<[`ZcashNewAccount`](../interfaces/ZcashNewAccount.md)\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:158](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L158)

Create a new HD account

#### Returns

`Promise`\<[`ZcashNewAccount`](../interfaces/ZcashNewAccount.md)\>

New account number

***

### getAddressForAccount()

> **getAddressForAccount**(`account`, `receiverTypes?`, `diversifierIndex?`): `Promise`\<[`ZcashAccountAddress`](../interfaces/ZcashAccountAddress.md)\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:170](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L170)

Get or derive an address for an account

#### Parameters

##### account

`number`

Account number

##### receiverTypes?

[`ZcashReceiverType`](../type-aliases/ZcashReceiverType.md)[]

Optional receiver types (default: best shielded + p2pkh)

##### diversifierIndex?

`number`

Optional specific diversifier index

#### Returns

`Promise`\<[`ZcashAccountAddress`](../interfaces/ZcashAccountAddress.md)\>

Account address info

***

### ~~generateShieldedAddress()~~

> **generateShieldedAddress**(`type`): `Promise`\<`string`\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:192](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L192)

Generate a new shielded address (DEPRECATED)

#### Parameters

##### type

Address type ('sapling' or 'sprout')

`"sapling"` | `"sprout"`

#### Returns

`Promise`\<`string`\>

New shielded address

#### Deprecated

Use createAccount() and getAddressForAccount() instead

***

### listAddresses()

> **listAddresses**(): `Promise`\<`string`[]\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:205](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L205)

List all shielded addresses in the wallet

#### Returns

`Promise`\<`string`[]\>

Array of shielded addresses

***

### getAccountBalance()

> **getAccountBalance**(`account`, `minConf`): `Promise`\<[`ZcashAccountBalance`](../interfaces/ZcashAccountBalance.md)\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:218](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L218)

Get balance for an account

#### Parameters

##### account

`number`

Account number

##### minConf

`number` = `1`

Minimum confirmations (default: 1)

#### Returns

`Promise`\<[`ZcashAccountBalance`](../interfaces/ZcashAccountBalance.md)\>

Account balance by pool

***

### ~~getBalance()~~

> **getBalance**(`address`, `minConf`): `Promise`\<`number`\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:230](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L230)

Get balance for an address (DEPRECATED)

#### Parameters

##### address

`string`

Address to check

##### minConf

`number` = `1`

Minimum confirmations

#### Returns

`Promise`\<`number`\>

Balance in ZEC

#### Deprecated

Use getAccountBalance() instead

***

### getTotalBalance()

> **getTotalBalance**(`minConf`): `Promise`\<\{ `transparent`: `string`; `private`: `string`; `total`: `string`; \}\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:240](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L240)

Get total wallet balance

#### Parameters

##### minConf

`number` = `1`

Minimum confirmations

#### Returns

`Promise`\<\{ `transparent`: `string`; `private`: `string`; `total`: `string`; \}\>

Total balances (transparent, private, total)

***

### listUnspent()

> **listUnspent**(`minConf`, `maxConf`, `includeWatchonly`, `addresses?`): `Promise`\<[`ZcashUnspentNote`](../interfaces/ZcashUnspentNote.md)[]\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:259](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L259)

List unspent shielded notes

#### Parameters

##### minConf

`number` = `1`

Minimum confirmations (default: 1)

##### maxConf

`number` = `9999999`

Maximum confirmations (default: 9999999)

##### includeWatchonly

`boolean` = `false`

Include watchonly addresses

##### addresses?

`string`[]

Filter by addresses

#### Returns

`Promise`\<[`ZcashUnspentNote`](../interfaces/ZcashUnspentNote.md)[]\>

Array of unspent notes

***

### sendShielded()

> **sendShielded**(`params`): `Promise`\<`string`\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:280](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L280)

Send a shielded transaction

#### Parameters

##### params

[`ZcashShieldedSendParams`](../interfaces/ZcashShieldedSendParams.md)

Send parameters

#### Returns

`Promise`\<`string`\>

Operation ID for tracking

***

### shieldCoinbase()

> **shieldCoinbase**(`fromAddress`, `toAddress`, `fee?`, `limit?`): `Promise`\<\{ `operationid`: `string`; `shieldingUTXOs`: `number`; `shieldingValue`: `number`; \}\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:311](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L311)

Shield coinbase UTXOs to a shielded address

#### Parameters

##### fromAddress

`string`

Transparent address with coinbase

##### toAddress

`string`

Shielded destination

##### fee?

`number`

Optional fee

##### limit?

`number`

Max UTXOs to shield

#### Returns

`Promise`\<\{ `operationid`: `string`; `shieldingUTXOs`: `number`; `shieldingValue`: `number`; \}\>

Operation ID

***

### getOperationStatus()

> **getOperationStatus**(`operationIds?`): `Promise`\<[`ZcashOperation`](../interfaces/ZcashOperation.md)[]\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:331](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L331)

Get status of async operations

#### Parameters

##### operationIds?

`string`[]

Optional specific operation IDs

#### Returns

`Promise`\<[`ZcashOperation`](../interfaces/ZcashOperation.md)[]\>

Array of operation statuses

***

### getOperationResult()

> **getOperationResult**(`operationIds?`): `Promise`\<[`ZcashOperation`](../interfaces/ZcashOperation.md)[]\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:341](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L341)

Get and remove completed operation results

#### Parameters

##### operationIds?

`string`[]

Optional specific operation IDs

#### Returns

`Promise`\<[`ZcashOperation`](../interfaces/ZcashOperation.md)[]\>

Array of operation results

***

### listOperationIds()

> **listOperationIds**(`status?`): `Promise`\<`string`[]\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:351](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L351)

List all operation IDs

#### Parameters

##### status?

`string`

Optional filter by status

#### Returns

`Promise`\<`string`[]\>

Array of operation IDs

***

### waitForOperation()

> **waitForOperation**(`operationId`, `pollInterval`, `timeout`): `Promise`\<[`ZcashOperation`](../interfaces/ZcashOperation.md)\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:364](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L364)

Wait for an operation to complete

#### Parameters

##### operationId

`string`

Operation ID to wait for

##### pollInterval

`number` = `1000`

Poll interval in ms (default: 1000)

##### timeout

`number` = `300000`

Max wait time in ms (default: 300000 = 5 min)

#### Returns

`Promise`\<[`ZcashOperation`](../interfaces/ZcashOperation.md)\>

Completed operation

#### Throws

ZcashRPCError if operation fails or times out

***

### getBlockCount()

> **getBlockCount**(): `Promise`\<`number`\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:407](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L407)

Get current block count

#### Returns

`Promise`\<`number`\>

Current block height

***

### getBlockHash()

> **getBlockHash**(`height`): `Promise`\<`string`\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:417](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L417)

Get block hash at height

#### Parameters

##### height

`number`

Block height

#### Returns

`Promise`\<`string`\>

Block hash

***

### getBlockHeader()

> **getBlockHeader**(`hashOrHeight`): `Promise`\<[`ZcashBlockHeader`](../interfaces/ZcashBlockHeader.md)\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:427](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L427)

Get block header

#### Parameters

##### hashOrHeight

Block hash or height

`string` | `number`

#### Returns

`Promise`\<[`ZcashBlockHeader`](../interfaces/ZcashBlockHeader.md)\>

Block header

***

### getBlock()

> **getBlock**(`hashOrHeight`): `Promise`\<[`ZcashBlock`](../interfaces/ZcashBlock.md)\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:439](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L439)

Get full block data

#### Parameters

##### hashOrHeight

Block hash or height

`string` | `number`

#### Returns

`Promise`\<[`ZcashBlock`](../interfaces/ZcashBlock.md)\>

Block data

***

### getBlockchainInfo()

> **getBlockchainInfo**(): `Promise`\<[`ZcashBlockchainInfo`](../interfaces/ZcashBlockchainInfo.md)\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:450](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L450)

Get blockchain info

#### Returns

`Promise`\<[`ZcashBlockchainInfo`](../interfaces/ZcashBlockchainInfo.md)\>

Blockchain information

***

### getNetworkInfo()

> **getNetworkInfo**(): `Promise`\<[`ZcashNetworkInfo`](../interfaces/ZcashNetworkInfo.md)\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:459](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L459)

Get network info

#### Returns

`Promise`\<[`ZcashNetworkInfo`](../interfaces/ZcashNetworkInfo.md)\>

Network information

***

### exportViewingKey()

> **exportViewingKey**(`address`): `Promise`\<`string`\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:471](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L471)

Export viewing key for address

#### Parameters

##### address

`string`

Shielded address

#### Returns

`Promise`\<`string`\>

Viewing key

***

### importViewingKey()

> **importViewingKey**(`viewingKey`, `rescan`, `startHeight?`): `Promise`\<`void`\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:482](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L482)

Import viewing key

#### Parameters

##### viewingKey

`string`

The viewing key to import

##### rescan

Rescan the wallet (default: whenkeyisnew)

`"yes"` | `"no"` | `"whenkeyisnew"`

##### startHeight?

`number`

Start height for rescan

#### Returns

`Promise`\<`void`\>

***

### call()

> **call**\<`T`\>(`method`, `params`): `Promise`\<`T`\>

Defined in: [packages/sdk/src/zcash/rpc-client.ts:501](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/zcash/rpc-client.ts#L501)

Make a raw RPC call

#### Type Parameters

##### T

`T`

#### Parameters

##### method

`string`

RPC method name

##### params

`unknown`[] = `[]`

Method parameters

#### Returns

`Promise`\<`T`\>

RPC response result
