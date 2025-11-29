[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / TreasuryBalance

# Interface: TreasuryBalance

Defined in: packages/types/dist/index.d.ts:1727

Treasury balance for a specific token

## Properties

### token

> **token**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:1729

The token

***

### balance

> **balance**: `bigint`

Defined in: packages/types/dist/index.d.ts:1731

Balance in smallest units

***

### committed

> **committed**: `bigint`

Defined in: packages/types/dist/index.d.ts:1733

Committed (in pending proposals)

***

### available

> **available**: `bigint`

Defined in: packages/types/dist/index.d.ts:1735

Available (balance - committed)

***

### updatedAt

> **updatedAt**: `number`

Defined in: packages/types/dist/index.d.ts:1737

Last updated timestamp
