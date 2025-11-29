[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / WalletChainChangedEvent

# Interface: WalletChainChangedEvent

Defined in: packages/types/dist/index.d.ts:2289

Chain changed event - user switched networks

## Extends

- `WalletEventBase`

## Properties

### timestamp

> **timestamp**: `number`

Defined in: packages/types/dist/index.d.ts:2261

#### Inherited from

`WalletEventBase.timestamp`

***

### type

> **type**: `"chainChanged"`

Defined in: packages/types/dist/index.d.ts:2290

#### Overrides

`WalletEventBase.type`

***

### previousChain

> **previousChain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:2291

***

### newChain

> **newChain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:2292
