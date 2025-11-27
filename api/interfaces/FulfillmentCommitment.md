[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / FulfillmentCommitment

# Interface: FulfillmentCommitment

Defined in: packages/types/dist/index.d.ts:549

Solver's fulfillment commitment (for escrow/collateral)

## Properties

### quoteId

> **quoteId**: `string`

Defined in: packages/types/dist/index.d.ts:551

Quote being committed to

***

### collateral

> **collateral**: `bigint`

Defined in: packages/types/dist/index.d.ts:553

Solver's collateral (locked until fulfillment)

***

### deadline

> **deadline**: `number`

Defined in: packages/types/dist/index.d.ts:555

Deadline for fulfillment

***

### collateralProof

> **collateralProof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:557

Proof of collateral lock
