[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashNetworkInfo

# Interface: ZcashNetworkInfo

Defined in: packages/types/dist/index.d.ts:1335

Network information

## Properties

### version

> **version**: `number`

Defined in: packages/types/dist/index.d.ts:1337

Server version

***

### subversion

> **subversion**: `string`

Defined in: packages/types/dist/index.d.ts:1339

Server subversion string

***

### protocolversion

> **protocolversion**: `number`

Defined in: packages/types/dist/index.d.ts:1341

Protocol version

***

### localservices

> **localservices**: `string`

Defined in: packages/types/dist/index.d.ts:1343

Local services offered

***

### connections

> **connections**: `number`

Defined in: packages/types/dist/index.d.ts:1345

Number of connections

***

### networks

> **networks**: `object`[]

Defined in: packages/types/dist/index.d.ts:1347

Networks available

#### name

> **name**: `string`

#### limited

> **limited**: `boolean`

#### reachable

> **reachable**: `boolean`

***

### relayfee

> **relayfee**: `number`

Defined in: packages/types/dist/index.d.ts:1353

Relay fee

***

### localaddresses

> **localaddresses**: `object`[]

Defined in: packages/types/dist/index.d.ts:1355

Local addresses

#### address

> **address**: `string`

#### port

> **port**: `number`

#### score

> **score**: `number`
