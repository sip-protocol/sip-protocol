[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / OneClickClient

# Class: OneClickClient

Defined in: [packages/sdk/src/adapters/oneclick-client.ts:60](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/oneclick-client.ts#L60)

HTTP client for NEAR 1Click API

## Example

```typescript
const client = new OneClickClient({
  jwtToken: process.env.NEAR_INTENTS_JWT,
})

// Get available tokens
const tokens = await client.getTokens()

// Request a quote
const quote = await client.quote({
  swapType: OneClickSwapType.EXACT_INPUT,
  originAsset: 'near:mainnet:wrap.near',
  destinationAsset: 'eth:1:native',
  amount: '1000000000000000000000000',
  refundTo: 'user.near',
  recipient: '0x742d35Cc...',
  depositType: 'near',
  refundType: 'near',
  recipientType: 'eth',
})

// Check status
const status = await client.getStatus(quote.depositAddress)
```

## Constructors

### Constructor

> **new OneClickClient**(`config`): `OneClickClient`

Defined in: [packages/sdk/src/adapters/oneclick-client.ts:66](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/oneclick-client.ts#L66)

#### Parameters

##### config

[`OneClickConfig`](../interfaces/OneClickConfig.md) = `{}`

#### Returns

`OneClickClient`

## Methods

### getTokens()

> **getTokens**(): `Promise`\<`OneClickToken`[]\>

Defined in: [packages/sdk/src/adapters/oneclick-client.ts:78](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/oneclick-client.ts#L78)

Get all supported tokens

#### Returns

`Promise`\<`OneClickToken`[]\>

Array of supported tokens with metadata

***

### quote()

> **quote**(`request`): `Promise`\<[`OneClickQuoteResponse`](../interfaces/OneClickQuoteResponse.md)\>

Defined in: [packages/sdk/src/adapters/oneclick-client.ts:90](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/oneclick-client.ts#L90)

Request a swap quote

#### Parameters

##### request

[`OneClickQuoteRequest`](../interfaces/OneClickQuoteRequest.md)

Quote request parameters

#### Returns

`Promise`\<[`OneClickQuoteResponse`](../interfaces/OneClickQuoteResponse.md)\>

Quote response with deposit address and amounts

#### Throws

On API errors

#### Throws

On invalid parameters

***

### dryQuote()

> **dryQuote**(`request`): `Promise`\<[`OneClickQuoteResponse`](../interfaces/OneClickQuoteResponse.md)\>

Defined in: [packages/sdk/src/adapters/oneclick-client.ts:103](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/oneclick-client.ts#L103)

Request a dry quote (preview without deposit address)

Useful for UI price estimates without committing to a swap.

#### Parameters

##### request

`Omit`\<[`OneClickQuoteRequest`](../interfaces/OneClickQuoteRequest.md), `"dry"`\>

Quote request parameters (dry flag set automatically)

#### Returns

`Promise`\<[`OneClickQuoteResponse`](../interfaces/OneClickQuoteResponse.md)\>

Quote preview without deposit address

***

### submitDeposit()

> **submitDeposit**(`deposit`): `Promise`\<[`OneClickQuoteResponse`](../interfaces/OneClickQuoteResponse.md)\>

Defined in: [packages/sdk/src/adapters/oneclick-client.ts:115](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/oneclick-client.ts#L115)

Submit deposit transaction notification

Call this after depositing to the depositAddress to speed up detection.

#### Parameters

##### deposit

`OneClickDepositSubmit`

Deposit submission details

#### Returns

`Promise`\<[`OneClickQuoteResponse`](../interfaces/OneClickQuoteResponse.md)\>

Updated quote response

***

### getStatus()

> **getStatus**(`depositAddress`, `depositMemo?`): `Promise`\<[`OneClickStatusResponse`](../interfaces/OneClickStatusResponse.md)\>

Defined in: [packages/sdk/src/adapters/oneclick-client.ts:132](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/oneclick-client.ts#L132)

Get swap status

#### Parameters

##### depositAddress

`string`

Deposit address from quote

##### depositMemo?

`string`

Optional memo for memo-based deposits

#### Returns

`Promise`\<[`OneClickStatusResponse`](../interfaces/OneClickStatusResponse.md)\>

Current swap status

***

### waitForStatus()

> **waitForStatus**(`depositAddress`, `options`): `Promise`\<[`OneClickStatusResponse`](../interfaces/OneClickStatusResponse.md)\>

Defined in: [packages/sdk/src/adapters/oneclick-client.ts:152](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/oneclick-client.ts#L152)

Poll status until terminal state or timeout

#### Parameters

##### depositAddress

`string`

Deposit address from quote

##### options

Polling options

###### interval?

`number`

Polling interval in ms (default: 3000)

###### timeout?

`number`

Maximum wait time in ms (default: 300000 = 5 minutes)

###### onStatus?

(`status`) => `void`

Callback on each status check

#### Returns

`Promise`\<[`OneClickStatusResponse`](../interfaces/OneClickStatusResponse.md)\>

Final status when terminal state reached

***

### getWithdrawals()

> **getWithdrawals**(`depositAddress`, `depositMemo?`, `options?`): `Promise`\<`OneClickWithdrawal`[]\>

Defined in: [packages/sdk/src/adapters/oneclick-client.ts:202](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/oneclick-client.ts#L202)

Get withdrawals for ANY_INPUT deposits

#### Parameters

##### depositAddress

`string`

Deposit address

##### depositMemo?

`string`

Optional deposit memo

##### options?

Pagination options

###### timestampFrom?

`string`

###### page?

`number`

###### limit?

`number`

###### sortOrder?

`"asc"` \| `"desc"`

#### Returns

`Promise`\<`OneClickWithdrawal`[]\>

Array of withdrawals
