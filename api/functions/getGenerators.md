[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / getGenerators

# Function: getGenerators()

> **getGenerators**(): `object`

Defined in: [packages/sdk/src/commitment.ts:426](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/commitment.ts#L426)

Get the generators for ZK proof integration

Returns the G and H points for use in Noir circuits.

## Returns

`object`

### G

> **G**: `object`

#### G.x

> **x**: `` `0x${string}` ``

#### G.y

> **y**: `` `0x${string}` ``

### H

> **H**: `object`

#### H.x

> **x**: `` `0x${string}` ``

#### H.y

> **y**: `` `0x${string}` ``
