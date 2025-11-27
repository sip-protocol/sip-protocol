[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashConfig

# Interface: ZcashConfig

Defined in: packages/types/dist/index.d.ts:998

Zcash RPC client configuration

## Properties

### host?

> `optional` **host**: `string`

Defined in: packages/types/dist/index.d.ts:1000

RPC host (default: 127.0.0.1)

***

### port?

> `optional` **port**: `number`

Defined in: packages/types/dist/index.d.ts:1002

RPC port (default: 8232 mainnet, 18232 testnet)

***

### username

> **username**: `string`

Defined in: packages/types/dist/index.d.ts:1004

RPC username

***

### password

> **password**: `string`

Defined in: packages/types/dist/index.d.ts:1006

RPC password

***

### testnet?

> `optional` **testnet**: `boolean`

Defined in: packages/types/dist/index.d.ts:1008

Use testnet (default: false)

***

### timeout?

> `optional` **timeout**: `number`

Defined in: packages/types/dist/index.d.ts:1010

Request timeout in ms (default: 30000)

***

### retries?

> `optional` **retries**: `number`

Defined in: packages/types/dist/index.d.ts:1012

Number of retries on failure (default: 3)

***

### retryDelay?

> `optional` **retryDelay**: `number`

Defined in: packages/types/dist/index.d.ts:1014

Retry delay in ms (default: 1000)
