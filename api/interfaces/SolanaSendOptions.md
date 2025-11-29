[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SolanaSendOptions

# Interface: SolanaSendOptions

Defined in: [packages/sdk/src/wallet/solana/types.ts:46](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L46)

Solana send options

## Properties

### skipPreflight?

> `optional` **skipPreflight**: `boolean`

Defined in: [packages/sdk/src/wallet/solana/types.ts:48](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L48)

Skip preflight transaction checks

***

### preflightCommitment?

> `optional` **preflightCommitment**: `"confirmed"` \| `"processed"` \| `"finalized"`

Defined in: [packages/sdk/src/wallet/solana/types.ts:50](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L50)

Preflight commitment level

***

### maxRetries?

> `optional` **maxRetries**: `number`

Defined in: [packages/sdk/src/wallet/solana/types.ts:52](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L52)

Maximum retries
