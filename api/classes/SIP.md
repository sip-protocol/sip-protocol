[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SIP

# Class: SIP

Defined in: [packages/sdk/src/sip.ts:114](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L114)

Main SIP SDK class

## Constructors

### Constructor

> **new SIP**(`config`): `SIP`

Defined in: [packages/sdk/src/sip.ts:127](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L127)

#### Parameters

##### config

[`SIPConfig`](../interfaces/SIPConfig.md)

#### Returns

`SIP`

## Methods

### getMode()

> **getMode**(): `"demo"` \| `"production"`

Defined in: [packages/sdk/src/sip.ts:180](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L180)

Get the current mode

#### Returns

`"demo"` \| `"production"`

***

### isProductionMode()

> **isProductionMode**(): `boolean`

Defined in: [packages/sdk/src/sip.ts:187](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L187)

Check if running in production mode with real NEAR Intents

#### Returns

`boolean`

***

### getIntentsAdapter()

> **getIntentsAdapter**(): [`NEARIntentsAdapter`](NEARIntentsAdapter.md) \| `undefined`

Defined in: [packages/sdk/src/sip.ts:194](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L194)

Get the NEAR Intents adapter

#### Returns

[`NEARIntentsAdapter`](NEARIntentsAdapter.md) \| `undefined`

***

### setIntentsAdapter()

> **setIntentsAdapter**(`adapter`): `void`

Defined in: [packages/sdk/src/sip.ts:201](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L201)

Set the NEAR Intents adapter

#### Parameters

##### adapter

[`NEARIntentsAdapterConfig`](../interfaces/NEARIntentsAdapterConfig.md) | [`NEARIntentsAdapter`](NEARIntentsAdapter.md)

#### Returns

`void`

***

### getProofProvider()

> **getProofProvider**(): [`ProofProvider`](../interfaces/ProofProvider.md) \| `undefined`

Defined in: [packages/sdk/src/sip.ts:212](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L212)

Get the configured proof provider

#### Returns

[`ProofProvider`](../interfaces/ProofProvider.md) \| `undefined`

***

### setProofProvider()

> **setProofProvider**(`provider`): `void`

Defined in: [packages/sdk/src/sip.ts:219](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L219)

Set or update the proof provider

#### Parameters

##### provider

[`ProofProvider`](../interfaces/ProofProvider.md)

#### Returns

`void`

***

### hasProofProvider()

> **hasProofProvider**(): `boolean`

Defined in: [packages/sdk/src/sip.ts:226](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L226)

Check if proof provider is available and ready

#### Returns

`boolean`

***

### connect()

> **connect**(`wallet`): `void`

Defined in: [packages/sdk/src/sip.ts:233](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L233)

Connect a wallet

#### Parameters

##### wallet

[`WalletAdapter`](../interfaces/WalletAdapter.md)

#### Returns

`void`

***

### disconnect()

> **disconnect**(): `void`

Defined in: [packages/sdk/src/sip.ts:240](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L240)

Disconnect wallet

#### Returns

`void`

***

### isConnected()

> **isConnected**(): `boolean`

Defined in: [packages/sdk/src/sip.ts:247](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L247)

Check if wallet is connected

#### Returns

`boolean`

***

### getWallet()

> **getWallet**(): [`WalletAdapter`](../interfaces/WalletAdapter.md) \| `undefined`

Defined in: [packages/sdk/src/sip.ts:254](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L254)

Get connected wallet

#### Returns

[`WalletAdapter`](../interfaces/WalletAdapter.md) \| `undefined`

***

### generateStealthKeys()

> **generateStealthKeys**(`chain`, `label?`): [`StealthMetaAddress`](../interfaces/StealthMetaAddress.md)

Defined in: [packages/sdk/src/sip.ts:263](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L263)

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

Defined in: [packages/sdk/src/sip.ts:273](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L273)

Get the encoded stealth meta-address for receiving

#### Returns

`string` \| `undefined`

***

### intent()

> **intent**(): [`IntentBuilder`](IntentBuilder.md)

Defined in: [packages/sdk/src/sip.ts:293](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L293)

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

Defined in: [packages/sdk/src/sip.ts:307](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L307)

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

> **getQuotes**(`params`, `recipientMetaAddress?`): `Promise`\<[`ProductionQuote`](../interfaces/ProductionQuote.md)[]\>

Defined in: [packages/sdk/src/sip.ts:325](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L325)

Get quotes for an intent

In production mode: fetches real quotes from NEAR 1Click API
In demo mode: returns mock quotes for testing

#### Parameters

##### params

Intent parameters (CreateIntentParams for production, ShieldedIntent/CreateIntentParams for demo)

[`CreateIntentParams`](../interfaces/CreateIntentParams.md) | [`ShieldedIntent`](../interfaces/ShieldedIntent.md)

##### recipientMetaAddress?

Optional stealth meta-address for privacy modes

`string` | [`StealthMetaAddress`](../interfaces/StealthMetaAddress.md)

#### Returns

`Promise`\<[`ProductionQuote`](../interfaces/ProductionQuote.md)[]\>

Array of quotes (with deposit info in production mode)

***

### execute()

> **execute**(`intent`, `quote`, `options?`): `Promise`\<[`FulfillmentResult`](../interfaces/FulfillmentResult.md)\>

Defined in: [packages/sdk/src/sip.ts:356](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L356)

Execute an intent with a selected quote

In production mode: initiates real swap via NEAR 1Click API
In demo mode: returns mock result

#### Parameters

##### intent

[`TrackedIntent`](../interfaces/TrackedIntent.md)

The intent to execute

##### quote

Selected quote from getQuotes()

[`Quote`](../interfaces/Quote.md) | [`ProductionQuote`](../interfaces/ProductionQuote.md)

##### options?

Execution options

###### onDepositRequired?

(`depositAddress`, `amount`) => `Promise`\<`string`\>

Callback when deposit is required

###### onStatusUpdate?

(`status`) => `void`

Callback for status updates

###### timeout?

`number`

Timeout for waiting (ms)

#### Returns

`Promise`\<[`FulfillmentResult`](../interfaces/FulfillmentResult.md)\>

Fulfillment result with transaction hash (when available)

***

### generateViewingKey()

> **generateViewingKey**(`path?`): [`ViewingKey`](../interfaces/ViewingKey.md)

Defined in: [packages/sdk/src/sip.ts:380](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L380)

Generate a viewing key for compliant mode

#### Parameters

##### path?

`string`

#### Returns

[`ViewingKey`](../interfaces/ViewingKey.md)

***

### deriveViewingKey()

> **deriveViewingKey**(`masterKey`, `childPath`): [`ViewingKey`](../interfaces/ViewingKey.md)

Defined in: [packages/sdk/src/sip.ts:387](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L387)

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

Defined in: [packages/sdk/src/sip.ts:394](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L394)

Get network configuration

#### Returns

`"mainnet"` \| `"testnet"`
