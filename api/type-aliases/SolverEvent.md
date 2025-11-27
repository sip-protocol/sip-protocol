[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SolverEvent

# Type Alias: SolverEvent

> **SolverEvent** = \{ `type`: `"quote_generated"`; `data`: \{ `intentId`: `string`; `quote`: [`SolverQuote`](../interfaces/SolverQuote.md); \}; \} \| \{ `type`: `"fulfillment_started"`; `data`: \{ `intentId`: `string`; `txHash`: `string`; \}; \} \| \{ `type`: `"fulfillment_completed"`; `data`: \{ `intentId`: `string`; `proof`: [`FulfillmentProof`](../interfaces/FulfillmentProof.md); \}; \} \| \{ `type`: `"fulfillment_failed"`; `data`: \{ `intentId`: `string`; `error`: `string`; \}; \}

Defined in: packages/types/dist/index.d.ts:581

Events emitted by solvers
