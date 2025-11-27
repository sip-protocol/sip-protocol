[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SIP

# Class: SIP

Defined in: [packages/sdk/src/sip.ts:76](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L76)

Main SIP SDK class

## Constructors

### Constructor

> **new SIP**(`config`): `SIP`

Defined in: [packages/sdk/src/sip.ts:86](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L86)

#### Parameters

##### config

[`SIPConfig`](../interfaces/SIPConfig.md)

#### Returns

`SIP`

## Methods

### getProofProvider()

> **getProofProvider**(): [`ProofProvider`](../interfaces/ProofProvider.md) \| `undefined`

Defined in: [packages/sdk/src/sip.ts:121](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L121)

Get the configured proof provider

#### Returns

[`ProofProvider`](../interfaces/ProofProvider.md) \| `undefined`

***

### setProofProvider()

> **setProofProvider**(`provider`): `void`

Defined in: [packages/sdk/src/sip.ts:128](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L128)

Set or update the proof provider

#### Parameters

##### provider

[`ProofProvider`](../interfaces/ProofProvider.md)

#### Returns

`void`

***

### hasProofProvider()

> **hasProofProvider**(): `boolean`

Defined in: [packages/sdk/src/sip.ts:135](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L135)

Check if proof provider is available and ready

#### Returns

`boolean`

***

### connect()

> **connect**(`wallet`): `void`

Defined in: [packages/sdk/src/sip.ts:142](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L142)

Connect a wallet

#### Parameters

##### wallet

[`WalletAdapter`](../interfaces/WalletAdapter.md)

#### Returns

`void`

***

### disconnect()

> **disconnect**(): `void`

Defined in: [packages/sdk/src/sip.ts:149](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L149)

Disconnect wallet

#### Returns

`void`

***

### isConnected()

> **isConnected**(): `boolean`

Defined in: [packages/sdk/src/sip.ts:156](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L156)

Check if wallet is connected

#### Returns

`boolean`

***

### getWallet()

> **getWallet**(): [`WalletAdapter`](../interfaces/WalletAdapter.md) \| `undefined`

Defined in: [packages/sdk/src/sip.ts:163](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L163)

Get connected wallet

#### Returns

[`WalletAdapter`](../interfaces/WalletAdapter.md) \| `undefined`

***

### generateStealthKeys()

> **generateStealthKeys**(`chain`, `label?`): [`StealthMetaAddress`](../interfaces/StealthMetaAddress.md)

Defined in: [packages/sdk/src/sip.ts:172](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L172)

Generate and store stealth keys for this session

#### Parameters

##### chain

[`ChainId`](../type-aliases/ChainId.md)

##### label?

`string`

#### Returns

[`StealthMetaAddress`](../interfaces/StealthMetaAddress.md)

#### Throws

If chain is invalid

***

### getStealthAddress()

> **getStealthAddress**(): `string` \| `undefined`

Defined in: [packages/sdk/src/sip.ts:182](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L182)

Get the encoded stealth meta-address for receiving

#### Returns

`string` \| `undefined`

***

### intent()

> **intent**(): [`IntentBuilder`](IntentBuilder.md)

Defined in: [packages/sdk/src/sip.ts:202](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L202)

Create a new intent builder

The builder is automatically configured with the SIP client's proof provider
(if one is set), so proofs will be generated automatically when `.build()` is called.

#### Returns

[`IntentBuilder`](IntentBuilder.md)

#### Example

```typescript
const intent = await sip.intent()
  .input('near', 'NEAR', 100n)
  .output('zcash', 'ZEC', 95n)
  .privacy(PrivacyLevel.SHIELDED)
  .build()
```

***

### createIntent()

> **createIntent**(`params`): `Promise`\<[`TrackedIntent`](../interfaces/TrackedIntent.md)\>

Defined in: [packages/sdk/src/sip.ts:216](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L216)

Create a shielded intent directly

Uses the SIP client's configured proof provider (if any) to generate proofs
automatically for SHIELDED and COMPLIANT privacy levels.

#### Parameters

##### params

[`CreateIntentParams`](../interfaces/CreateIntentParams.md)

#### Returns

`Promise`\<[`TrackedIntent`](../interfaces/TrackedIntent.md)\>

***

### getQuotes()

> **getQuotes**(`intent`): `Promise`\<[`Quote`](../interfaces/Quote.md)[]\>

Defined in: [packages/sdk/src/sip.ts:227](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L227)

Get quotes for an intent (mock implementation)

#### Parameters

##### intent

[`ShieldedIntent`](../interfaces/ShieldedIntent.md)

#### Returns

`Promise`\<[`Quote`](../interfaces/Quote.md)[]\>

***

### execute()

> **execute**(`intent`, `quote`): `Promise`\<[`FulfillmentResult`](../interfaces/FulfillmentResult.md)\>

Defined in: [packages/sdk/src/sip.ts:256](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L256)

Execute an intent with a selected quote (mock implementation)

#### Parameters

##### intent

[`TrackedIntent`](../interfaces/TrackedIntent.md)

##### quote

[`Quote`](../interfaces/Quote.md)

#### Returns

`Promise`\<[`FulfillmentResult`](../interfaces/FulfillmentResult.md)\>

***

### generateViewingKey()

> **generateViewingKey**(`path?`): [`ViewingKey`](../interfaces/ViewingKey.md)

Defined in: [packages/sdk/src/sip.ts:275](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L275)

Generate a viewing key for compliant mode

#### Parameters

##### path?

`string`

#### Returns

[`ViewingKey`](../interfaces/ViewingKey.md)

***

### deriveViewingKey()

> **deriveViewingKey**(`masterKey`, `childPath`): [`ViewingKey`](../interfaces/ViewingKey.md)

Defined in: [packages/sdk/src/sip.ts:282](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L282)

Derive a child viewing key

#### Parameters

##### masterKey

[`ViewingKey`](../interfaces/ViewingKey.md)

##### childPath

`string`

#### Returns

[`ViewingKey`](../interfaces/ViewingKey.md)

***

### getNetwork()

> **getNetwork**(): `"mainnet"` \| `"testnet"`

Defined in: [packages/sdk/src/sip.ts:289](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L289)

Get network configuration

#### Returns

`"mainnet"` \| `"testnet"`
