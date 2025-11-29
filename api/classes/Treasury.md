[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / Treasury

# Class: Treasury

Defined in: [packages/sdk/src/treasury/treasury.ts:75](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L75)

Treasury class - manages DAO treasury with multi-sig support

## Accessors

### treasuryId

#### Get Signature

> **get** **treasuryId**(): `string`

Defined in: [packages/sdk/src/treasury/treasury.ts:133](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L133)

##### Returns

`string`

***

### name

#### Get Signature

> **get** **name**(): `string`

Defined in: [packages/sdk/src/treasury/treasury.ts:137](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L137)

##### Returns

`string`

***

### chain

#### Get Signature

> **get** **chain**(): [`ChainId`](../type-aliases/ChainId.md)

Defined in: [packages/sdk/src/treasury/treasury.ts:141](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L141)

##### Returns

[`ChainId`](../type-aliases/ChainId.md)

***

### signingThreshold

#### Get Signature

> **get** **signingThreshold**(): `number`

Defined in: [packages/sdk/src/treasury/treasury.ts:145](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L145)

##### Returns

`number`

***

### members

#### Get Signature

> **get** **members**(): [`TreasuryMember`](../interfaces/TreasuryMember.md)[]

Defined in: [packages/sdk/src/treasury/treasury.ts:149](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L149)

##### Returns

[`TreasuryMember`](../interfaces/TreasuryMember.md)[]

***

### masterViewingKey

#### Get Signature

> **get** **masterViewingKey**(): [`ViewingKey`](../interfaces/ViewingKey.md) \| `undefined`

Defined in: [packages/sdk/src/treasury/treasury.ts:153](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L153)

##### Returns

[`ViewingKey`](../interfaces/ViewingKey.md) \| `undefined`

## Methods

### create()

> `static` **create**(`params`): `Promise`\<`Treasury`\>

Defined in: [packages/sdk/src/treasury/treasury.ts:89](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L89)

Create a new treasury

#### Parameters

##### params

[`CreateTreasuryParams`](../interfaces/CreateTreasuryParams.md)

#### Returns

`Promise`\<`Treasury`\>

***

### fromConfig()

> `static` **fromConfig**(`config`): `Treasury`

Defined in: [packages/sdk/src/treasury/treasury.ts:127](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L127)

Load a treasury from config

#### Parameters

##### config

[`TreasuryConfig`](../interfaces/TreasuryConfig.md)

#### Returns

`Treasury`

***

### getConfig()

> **getConfig**(): [`TreasuryConfig`](../interfaces/TreasuryConfig.md)

Defined in: [packages/sdk/src/treasury/treasury.ts:160](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L160)

Get treasury configuration

#### Returns

[`TreasuryConfig`](../interfaces/TreasuryConfig.md)

***

### getMember()

> **getMember**(`address`): [`TreasuryMember`](../interfaces/TreasuryMember.md) \| `undefined`

Defined in: [packages/sdk/src/treasury/treasury.ts:169](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L169)

Get a member by address

#### Parameters

##### address

`string`

#### Returns

[`TreasuryMember`](../interfaces/TreasuryMember.md) \| `undefined`

***

### isSigner()

> **isSigner**(`address`): `boolean`

Defined in: [packages/sdk/src/treasury/treasury.ts:176](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L176)

Check if an address is a signer

#### Parameters

##### address

`string`

#### Returns

`boolean`

***

### canCreateProposal()

> **canCreateProposal**(`address`): `boolean`

Defined in: [packages/sdk/src/treasury/treasury.ts:184](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L184)

Check if an address can create proposals

#### Parameters

##### address

`string`

#### Returns

`boolean`

***

### getSigners()

> **getSigners**(): [`TreasuryMember`](../interfaces/TreasuryMember.md)[]

Defined in: [packages/sdk/src/treasury/treasury.ts:192](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L192)

Get all signers

#### Returns

[`TreasuryMember`](../interfaces/TreasuryMember.md)[]

***

### createPaymentProposal()

> **createPaymentProposal**(`params`): `Promise`\<[`TreasuryProposal`](../interfaces/TreasuryProposal.md)\>

Defined in: [packages/sdk/src/treasury/treasury.ts:201](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L201)

Create a single payment proposal

#### Parameters

##### params

[`CreatePaymentProposalParams`](../interfaces/CreatePaymentProposalParams.md)

#### Returns

`Promise`\<[`TreasuryProposal`](../interfaces/TreasuryProposal.md)\>

***

### createBatchProposal()

> **createBatchProposal**(`params`): `Promise`\<[`TreasuryProposal`](../interfaces/TreasuryProposal.md)\>

Defined in: [packages/sdk/src/treasury/treasury.ts:236](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L236)

Create a batch payment proposal

#### Parameters

##### params

[`CreateBatchProposalParams`](../interfaces/CreateBatchProposalParams.md)

#### Returns

`Promise`\<[`TreasuryProposal`](../interfaces/TreasuryProposal.md)\>

***

### getProposal()

> **getProposal**(`proposalId`): [`TreasuryProposal`](../interfaces/TreasuryProposal.md) \| `undefined`

Defined in: [packages/sdk/src/treasury/treasury.ts:272](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L272)

Get a proposal by ID

#### Parameters

##### proposalId

`string`

#### Returns

[`TreasuryProposal`](../interfaces/TreasuryProposal.md) \| `undefined`

***

### getAllProposals()

> **getAllProposals**(): [`TreasuryProposal`](../interfaces/TreasuryProposal.md)[]

Defined in: [packages/sdk/src/treasury/treasury.ts:279](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L279)

Get all proposals

#### Returns

[`TreasuryProposal`](../interfaces/TreasuryProposal.md)[]

***

### getPendingProposals()

> **getPendingProposals**(): [`TreasuryProposal`](../interfaces/TreasuryProposal.md)[]

Defined in: [packages/sdk/src/treasury/treasury.ts:286](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L286)

Get pending proposals

#### Returns

[`TreasuryProposal`](../interfaces/TreasuryProposal.md)[]

***

### signProposal()

> **signProposal**(`proposalId`, `signerAddress`, `privateKey`, `approve`): `Promise`\<[`TreasuryProposal`](../interfaces/TreasuryProposal.md)\>

Defined in: [packages/sdk/src/treasury/treasury.ts:293](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L293)

Sign a proposal

#### Parameters

##### proposalId

`string`

##### signerAddress

`string`

##### privateKey

`` `0x${string}` ``

##### approve

`boolean` = `true`

#### Returns

`Promise`\<[`TreasuryProposal`](../interfaces/TreasuryProposal.md)\>

***

### executeProposal()

> **executeProposal**(`proposalId`): `Promise`\<[`ShieldedPayment`](../interfaces/ShieldedPayment.md)[]\>

Defined in: [packages/sdk/src/treasury/treasury.ts:395](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L395)

Execute an approved proposal

#### Parameters

##### proposalId

`string`

#### Returns

`Promise`\<[`ShieldedPayment`](../interfaces/ShieldedPayment.md)[]\>

***

### cancelProposal()

> **cancelProposal**(`proposalId`, `cancellerAddress`): [`TreasuryProposal`](../interfaces/TreasuryProposal.md)

Defined in: [packages/sdk/src/treasury/treasury.ts:468](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L468)

Cancel a proposal (only by proposer or owner)

#### Parameters

##### proposalId

`string`

##### cancellerAddress

`string`

#### Returns

[`TreasuryProposal`](../interfaces/TreasuryProposal.md)

***

### grantAuditorAccess()

> **grantAuditorAccess**(`auditorId`, `auditorName`, `granterAddress`, `scope`, `validUntil?`): [`AuditorViewingKey`](../interfaces/AuditorViewingKey.md)

Defined in: [packages/sdk/src/treasury/treasury.ts:511](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L511)

Grant viewing access to an auditor

#### Parameters

##### auditorId

`string`

##### auditorName

`string`

##### granterAddress

`string`

##### scope

`"all"` | `"inbound"` | `"outbound"`

##### validUntil?

`number`

#### Returns

[`AuditorViewingKey`](../interfaces/AuditorViewingKey.md)

***

### revokeAuditorAccess()

> **revokeAuditorAccess**(`auditorId`, `revokerAddress`): `boolean`

Defined in: [packages/sdk/src/treasury/treasury.ts:562](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L562)

Revoke auditor access

#### Parameters

##### auditorId

`string`

##### revokerAddress

`string`

#### Returns

`boolean`

***

### getAuditorKeys()

> **getAuditorKeys**(): [`AuditorViewingKey`](../interfaces/AuditorViewingKey.md)[]

Defined in: [packages/sdk/src/treasury/treasury.ts:579](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L579)

Get all auditor keys

#### Returns

[`AuditorViewingKey`](../interfaces/AuditorViewingKey.md)[]

***

### updateBalance()

> **updateBalance**(`token`, `balance`): `void`

Defined in: [packages/sdk/src/treasury/treasury.ts:588](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L588)

Update balance for a token (called after deposits/withdrawals)

#### Parameters

##### token

[`Asset`](../interfaces/Asset.md)

##### balance

`bigint`

#### Returns

`void`

***

### getBalance()

> **getBalance**(`token`): [`TreasuryBalance`](../interfaces/TreasuryBalance.md) \| `undefined`

Defined in: [packages/sdk/src/treasury/treasury.ts:604](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L604)

Get balance for a token

#### Parameters

##### token

[`Asset`](../interfaces/Asset.md)

#### Returns

[`TreasuryBalance`](../interfaces/TreasuryBalance.md) \| `undefined`

***

### getAllBalances()

> **getAllBalances**(): [`TreasuryBalance`](../interfaces/TreasuryBalance.md)[]

Defined in: [packages/sdk/src/treasury/treasury.ts:612](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L612)

Get all balances

#### Returns

[`TreasuryBalance`](../interfaces/TreasuryBalance.md)[]

***

### toJSON()

> **toJSON**(): `string`

Defined in: [packages/sdk/src/treasury/treasury.ts:646](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L646)

Serialize treasury to JSON

#### Returns

`string`

***

### fromJSON()

> `static` **fromJSON**(`json`): `Treasury`

Defined in: [packages/sdk/src/treasury/treasury.ts:658](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/treasury/treasury.ts#L658)

Deserialize treasury from JSON

#### Parameters

##### json

`string`

#### Returns

`Treasury`
