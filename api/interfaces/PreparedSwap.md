[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / PreparedSwap

# Interface: PreparedSwap

Defined in: [packages/sdk/src/adapters/near-intents.ts:49](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L49)

Result of preparing a swap with SIP privacy

## Properties

### request

> **request**: [`SwapRequest`](SwapRequest.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:51](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L51)

Original swap request

***

### quoteRequest

> **quoteRequest**: [`OneClickQuoteRequest`](OneClickQuoteRequest.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:53](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L53)

1Click quote request

***

### stealthAddress?

> `optional` **stealthAddress**: `object`

Defined in: [packages/sdk/src/adapters/near-intents.ts:55](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L55)

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

Defined in: [packages/sdk/src/adapters/near-intents.ts:61](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L61)

Shared secret for stealth address derivation (keep private!)
