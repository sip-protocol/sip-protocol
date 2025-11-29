[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashNetworkInfo

# Interface: ZcashNetworkInfo

Defined in: packages/types/dist/index.d.ts:1367

Network information

## Properties

### version

> **version**: `number`

Defined in: packages/types/dist/index.d.ts:1369

Server version

***

### subversion

> **subversion**: `string`

Defined in: packages/types/dist/index.d.ts:1371

Server subversion string

***

### protocolversion

> **protocolversion**: `number`

Defined in: packages/types/dist/index.d.ts:1373

Protocol version

***

### localservices

> **localservices**: `string`

Defined in: packages/types/dist/index.d.ts:1375

Local services offered

***

### connections

> **connections**: `number`

Defined in: packages/types/dist/index.d.ts:1377

Number of connections

***

### networks

> **networks**: `object`[]

Defined in: packages/types/dist/index.d.ts:1379

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

Defined in: packages/types/dist/index.d.ts:1385

Relay fee

***

### localaddresses

> **localaddresses**: `object`[]

Defined in: packages/types/dist/index.d.ts:1387

Local addresses

#### address

> **address**: `string`

#### port

> **port**: `number`

#### score

> **score**: `number`
