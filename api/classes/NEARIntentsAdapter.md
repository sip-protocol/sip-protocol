[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / NEARIntentsAdapter

# Class: NEARIntentsAdapter

Defined in: [packages/sdk/src/adapters/near-intents.ts:186](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L186)

NEAR Intents Adapter

Provides privacy-preserving cross-chain swaps via NEAR 1Click API.

## Example

```typescript
const adapter = new NEARIntentsAdapter({
  jwtToken: process.env.NEAR_INTENTS_JWT,
})

// Or with custom asset mappings (e.g., testnet)
const testnetAdapter = new NEARIntentsAdapter({
  jwtToken: process.env.NEAR_INTENTS_JWT,
  assetMappings: {
    'near:testUSDC': 'near:testnet:usdc.test',
  },
})

// Prepare a swap with stealth recipient
const prepared = await adapter.prepareSwap(intent, recipientMetaAddress)

// Get quote
const quote = await adapter.getQuote(prepared)

// Execute (after depositing to depositAddress)
const result = await adapter.trackSwap(quote.depositAddress)
```

## Constructors

### Constructor

> **new NEARIntentsAdapter**(`config`): `NEARIntentsAdapter`

Defined in: [packages/sdk/src/adapters/near-intents.ts:192](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L192)

#### Parameters

##### config

[`NEARIntentsAdapterConfig`](../interfaces/NEARIntentsAdapterConfig.md) = `{}`

#### Returns

`NEARIntentsAdapter`

## Methods

### getClient()

> **getClient**(): [`OneClickClient`](OneClickClient.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:208](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L208)

Get the underlying OneClick client

#### Returns

[`OneClickClient`](OneClickClient.md)

***

### prepareSwap()

> **prepareSwap**(`request`, `recipientMetaAddress?`, `senderAddress?`): `Promise`\<[`PreparedSwap`](../interfaces/PreparedSwap.md)\>

Defined in: [packages/sdk/src/adapters/near-intents.ts:222](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L222)

Prepare a swap request

For shielded/compliant modes, generates a stealth address for the recipient.

#### Parameters

##### request

[`SwapRequest`](../interfaces/SwapRequest.md)

Swap request parameters

##### recipientMetaAddress?

Recipient's stealth meta-address (for privacy modes)

`string` | [`StealthMetaAddress`](../interfaces/StealthMetaAddress.md)

##### senderAddress?

`string`

Sender's address for refunds

#### Returns

`Promise`\<[`PreparedSwap`](../interfaces/PreparedSwap.md)\>

Prepared swap with quote request

***

### getQuote()

> **getQuote**(`prepared`): `Promise`\<[`OneClickQuoteResponse`](../interfaces/OneClickQuoteResponse.md)\>

Defined in: [packages/sdk/src/adapters/near-intents.ts:283](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L283)

Get a quote for a prepared swap

#### Parameters

##### prepared

[`PreparedSwap`](../interfaces/PreparedSwap.md)

Prepared swap from prepareSwap()

#### Returns

`Promise`\<[`OneClickQuoteResponse`](../interfaces/OneClickQuoteResponse.md)\>

Quote response with deposit address

***

### getDryQuote()

> **getDryQuote**(`prepared`): `Promise`\<[`OneClickQuoteResponse`](../interfaces/OneClickQuoteResponse.md)\>

Defined in: [packages/sdk/src/adapters/near-intents.ts:293](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L293)

Get a dry quote (preview without deposit address)

#### Parameters

##### prepared

[`PreparedSwap`](../interfaces/PreparedSwap.md)

Prepared swap

#### Returns

`Promise`\<[`OneClickQuoteResponse`](../interfaces/OneClickQuoteResponse.md)\>

Quote preview

***

### notifyDeposit()

> **notifyDeposit**(`depositAddress`, `txHash`, `nearAccount?`): `Promise`\<`void`\>

Defined in: [packages/sdk/src/adapters/near-intents.ts:304](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L304)

Notify 1Click of deposit transaction

#### Parameters

##### depositAddress

`string`

Deposit address from quote

##### txHash

`string`

Deposit transaction hash

##### nearAccount?

`string`

NEAR account (if depositing from NEAR)

#### Returns

`Promise`\<`void`\>

***

### getStatus()

> **getStatus**(`depositAddress`): `Promise`\<[`OneClickStatusResponse`](../interfaces/OneClickStatusResponse.md)\>

Defined in: [packages/sdk/src/adapters/near-intents.ts:322](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L322)

Get current swap status

#### Parameters

##### depositAddress

`string`

Deposit address from quote

#### Returns

`Promise`\<[`OneClickStatusResponse`](../interfaces/OneClickStatusResponse.md)\>

Current status

***

### waitForCompletion()

> **waitForCompletion**(`depositAddress`, `options?`): `Promise`\<[`OneClickStatusResponse`](../interfaces/OneClickStatusResponse.md)\>

Defined in: [packages/sdk/src/adapters/near-intents.ts:333](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L333)

Wait for swap to complete

#### Parameters

##### depositAddress

`string`

Deposit address from quote

##### options?

Polling options

###### interval?

`number`

###### timeout?

`number`

###### onStatus?

(`status`) => `void`

#### Returns

`Promise`\<[`OneClickStatusResponse`](../interfaces/OneClickStatusResponse.md)\>

Final status

***

### initiateSwap()

> **initiateSwap**(`request`, `recipientMetaAddress?`, `senderAddress?`): `Promise`\<[`SwapResult`](../interfaces/SwapResult.md)\>

Defined in: [packages/sdk/src/adapters/near-intents.ts:357](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L357)

Execute a full swap flow

This is a convenience method that:
1. Prepares the swap with stealth address
2. Gets a quote
3. Returns all info needed for the user to deposit

#### Parameters

##### request

[`SwapRequest`](../interfaces/SwapRequest.md)

Swap request parameters

##### recipientMetaAddress?

Recipient's stealth meta-address

`string` | [`StealthMetaAddress`](../interfaces/StealthMetaAddress.md)

##### senderAddress?

`string`

Sender's address for refunds

#### Returns

`Promise`\<[`SwapResult`](../interfaces/SwapResult.md)\>

Swap result with deposit instructions

***

### mapAsset()

> **mapAsset**(`chain`, `symbol`): `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:385](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L385)

Convert SIP asset to Defuse asset identifier

#### Parameters

##### chain

[`ChainId`](../type-aliases/ChainId.md)

##### symbol

`string`

#### Returns

`string`

***

### ~~mapChainType()~~

> **mapChainType**(`chain`): `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:404](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L404)

Convert SIP chain ID to blockchain type

#### Parameters

##### chain

[`ChainId`](../type-aliases/ChainId.md)

#### Returns

`string`

#### Deprecated

Use getBlockchainType() instead. The 1Click API now uses ORIGIN_CHAIN/DESTINATION_CHAIN types.

***

### getBlockchainType()

> **getBlockchainType**(`chain`): `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:476](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L476)

Get blockchain type for a chain (for address format validation)

#### Parameters

##### chain

[`ChainId`](../type-aliases/ChainId.md)

#### Returns

`string`
