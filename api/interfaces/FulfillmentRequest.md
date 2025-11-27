[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / FulfillmentRequest

# Interface: FulfillmentRequest

Defined in: packages/types/dist/index.d.ts:536

Request to fulfill an intent

## Properties

### intent

> **intent**: [`ShieldedIntent`](ShieldedIntent.md)

Defined in: packages/types/dist/index.d.ts:538

The intent to fulfill

***

### quote

> **quote**: [`SolverQuote`](SolverQuote.md)

Defined in: packages/types/dist/index.d.ts:540

The accepted quote

***

### solverSignature

> **solverSignature**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:542

Solver's signature on the quote

***

### userSignature

> **userSignature**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:544

User's signature accepting the quote
