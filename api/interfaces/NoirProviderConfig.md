[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / NoirProviderConfig

# Interface: NoirProviderConfig

Defined in: [packages/sdk/src/proofs/noir.ts:53](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L53)

Noir Proof Provider Configuration

## Properties

### artifactsPath?

> `optional` **artifactsPath**: `string`

Defined in: [packages/sdk/src/proofs/noir.ts:58](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L58)

Path to compiled circuit artifacts
If not provided, uses bundled artifacts

***

### backend?

> `optional` **backend**: `"barretenberg"`

Defined in: [packages/sdk/src/proofs/noir.ts:64](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L64)

Backend to use for proof generation

#### Default

```ts
'barretenberg' (UltraHonk)
```

***

### verbose?

> `optional` **verbose**: `boolean`

Defined in: [packages/sdk/src/proofs/noir.ts:70](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L70)

Enable verbose logging for debugging

#### Default

```ts
false
```

***

### oraclePublicKey?

> `optional` **oraclePublicKey**: `PublicKeyCoordinates`

Defined in: [packages/sdk/src/proofs/noir.ts:76](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L76)

Oracle public key for verifying attestations in fulfillment proofs
Required for production use. If not provided, proofs will use placeholder keys.
