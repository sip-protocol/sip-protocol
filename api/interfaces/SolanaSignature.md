[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SolanaSignature

# Interface: SolanaSignature

Defined in: [packages/sdk/src/wallet/solana/types.ts:162](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L162)

Extended signature with Solana-specific data

## Properties

### signature

> **signature**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/solana/types.ts:164](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L164)

Raw signature bytes

***

### publicKey

> **publicKey**: `` `0x${string}` ``

Defined in: [packages/sdk/src/wallet/solana/types.ts:166](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L166)

Solana public key (base58)

***

### base58Signature?

> `optional` **base58Signature**: `string`

Defined in: [packages/sdk/src/wallet/solana/types.ts:168](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/solana/types.ts#L168)

Base58 encoded signature (Solana standard)
