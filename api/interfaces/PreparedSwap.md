[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / PreparedSwap

# Interface: PreparedSwap

Defined in: [packages/sdk/src/adapters/near-intents.ts:47](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L47)

Result of preparing a swap with SIP privacy

## Properties

### request

> **request**: [`SwapRequest`](SwapRequest.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:49](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L49)

Original swap request

***

### quoteRequest

> **quoteRequest**: [`OneClickQuoteRequest`](OneClickQuoteRequest.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:51](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L51)

1Click quote request

***

### stealthAddress?

> `optional` **stealthAddress**: `object`

Defined in: [packages/sdk/src/adapters/near-intents.ts:53](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L53)

Generated stealth address (for shielded/compliant modes)

#### address

> **address**: `` `0x${string}` ``

#### ephemeralPublicKey

> **ephemeralPublicKey**: `` `0x${string}` ``

#### viewTag

> **viewTag**: `number`

***

### sharedSecret?

> `optional` **sharedSecret**: `` `0x${string}` ``

Defined in: [packages/sdk/src/adapters/near-intents.ts:59](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L59)

Shared secret for stealth address derivation (keep private!)
