[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / OneClickConfig

# Interface: OneClickConfig

Defined in: packages/types/dist/index.d.ts:995

1Click API client configuration

## Properties

### baseUrl?

> `optional` **baseUrl**: `string`

Defined in: packages/types/dist/index.d.ts:997

Base URL (default: https://1click.chaindefuser.com)

***

### jwtToken?

> `optional` **jwtToken**: `string`

Defined in: packages/types/dist/index.d.ts:999

JWT token for authenticated requests

***

### timeout?

> `optional` **timeout**: `number`

Defined in: packages/types/dist/index.d.ts:1001

Request timeout in milliseconds

***

### fetch()?

> `optional` **fetch**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Defined in: packages/types/dist/index.d.ts:1003

Custom fetch implementation

#### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`URL` | `RequestInfo`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

#### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`string` | `URL` | `Request`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>
