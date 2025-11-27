[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / IntentBuilder

# Class: IntentBuilder

Defined in: [packages/sdk/src/intent.ts:58](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/intent.ts#L58)

Builder class for creating shielded intents

## Constructors

### Constructor

> **new IntentBuilder**(): `IntentBuilder`

#### Returns

`IntentBuilder`

## Methods

### input()

> **input**(`chain`, `token`, `amount`, `sourceAddress?`): `this`

Defined in: [packages/sdk/src/intent.ts:68](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/intent.ts#L68)

Set the input for the intent

#### Parameters

##### chain

`string`

##### token

`string`

##### amount

`number` | `bigint`

##### sourceAddress?

`string`

#### Returns

`this`

#### Throws

If chain or amount is invalid

***

### output()

> **output**(`chain`, `token`, `minAmount?`): `this`

Defined in: [packages/sdk/src/intent.ts:112](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/intent.ts#L112)

Set the output for the intent

#### Parameters

##### chain

`string`

##### token

`string`

##### minAmount?

`number` | `bigint`

#### Returns

`this`

#### Throws

If chain is invalid

***

### privacy()

> **privacy**(`level`): `this`

Defined in: [packages/sdk/src/intent.ts:155](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/intent.ts#L155)

Set the privacy level

#### Parameters

##### level

[`PrivacyLevel`](../enumerations/PrivacyLevel.md)

#### Returns

`this`

#### Throws

If privacy level is invalid

***

### recipient()

> **recipient**(`metaAddress`): `this`

Defined in: [packages/sdk/src/intent.ts:171](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/intent.ts#L171)

Set the recipient's stealth meta-address

#### Parameters

##### metaAddress

`string`

#### Returns

`this`

#### Throws

If stealth meta-address format is invalid

***

### slippage()

> **slippage**(`percent`): `this`

Defined in: [packages/sdk/src/intent.ts:188](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/intent.ts#L188)

Set slippage tolerance

#### Parameters

##### percent

`number`

Slippage percentage (e.g., 1 for 1%)

#### Returns

`this`

#### Throws

If slippage is out of range

***

### ttl()

> **ttl**(`seconds`): `this`

Defined in: [packages/sdk/src/intent.ts:208](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/intent.ts#L208)

Set time-to-live in seconds

#### Parameters

##### seconds

`number`

#### Returns

`this`

#### Throws

If TTL is not a positive integer

***

### withProvider()

> **withProvider**(`provider`): `this`

Defined in: [packages/sdk/src/intent.ts:236](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/intent.ts#L236)

Set the proof provider for automatic proof generation

#### Parameters

##### provider

[`ProofProvider`](../interfaces/ProofProvider.md)

The proof provider to use

#### Returns

`this`

this for chaining

#### Example

```typescript
const intent = await builder
  .input('near', 'NEAR', 100n)
  .output('zcash', 'ZEC', 95n)
  .privacy(PrivacyLevel.SHIELDED)
  .withProvider(mockProvider)
  .build()
```

***

### build()

> **build**(): `Promise`\<[`ShieldedIntent`](../interfaces/ShieldedIntent.md)\>

Defined in: [packages/sdk/src/intent.ts:249](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/intent.ts#L249)

Build the shielded intent

If a proof provider is set and the privacy level requires proofs,
they will be generated automatically.

#### Returns

`Promise`\<[`ShieldedIntent`](../interfaces/ShieldedIntent.md)\>

Promise resolving to the shielded intent
