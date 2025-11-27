[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / NoirProviderConfig

# Interface: NoirProviderConfig

Defined in: [packages/sdk/src/proofs/noir.ts:39](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L39)

Noir Proof Provider Configuration

## Properties

### artifactsPath?

> `optional` **artifactsPath**: `string`

Defined in: [packages/sdk/src/proofs/noir.ts:44](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L44)

Path to compiled circuit artifacts
If not provided, uses bundled artifacts

***

### backend?

> `optional` **backend**: `"barretenberg"`

Defined in: [packages/sdk/src/proofs/noir.ts:50](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L50)

Backend to use for proof generation

#### Default

```ts
'barretenberg' (UltraPlonk)
```

***

### verbose?

> `optional` **verbose**: `boolean`

Defined in: [packages/sdk/src/proofs/noir.ts:56](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L56)

Enable verbose logging for debugging

#### Default

```ts
false
```
