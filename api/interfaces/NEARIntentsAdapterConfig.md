[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / NEARIntentsAdapterConfig

# Interface: NEARIntentsAdapterConfig

Defined in: [packages/sdk/src/adapters/near-intents.ts:91](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L91)

Configuration for NEAR Intents adapter

## Properties

### client?

> `optional` **client**: [`OneClickClient`](../classes/OneClickClient.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:93](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L93)

OneClickClient instance or config

***

### baseUrl?

> `optional` **baseUrl**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:95](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L95)

Base URL for 1Click API

***

### jwtToken?

> `optional` **jwtToken**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:97](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L97)

JWT token for authentication

***

### defaultSlippage?

> `optional` **defaultSlippage**: `number`

Defined in: [packages/sdk/src/adapters/near-intents.ts:99](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L99)

Default slippage tolerance in basis points (100 = 1%)

***

### defaultDeadlineOffset?

> `optional` **defaultDeadlineOffset**: `number`

Defined in: [packages/sdk/src/adapters/near-intents.ts:101](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L101)

Default deadline offset in seconds

***

### assetMappings?

> `optional` **assetMappings**: `Record`\<`string`, `string`\>

Defined in: [packages/sdk/src/adapters/near-intents.ts:103](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L103)

Custom asset mappings (merged with defaults)
