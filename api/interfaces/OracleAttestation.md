[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / OracleAttestation

# Interface: OracleAttestation

Defined in: [packages/sdk/src/proofs/interface.ts:110](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L110)

Oracle attestation for cross-chain verification

## Properties

### recipient

> **recipient**: `` `0x${string}` ``

Defined in: [packages/sdk/src/proofs/interface.ts:112](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L112)

Recipient who received funds

***

### amount

> **amount**: `bigint`

Defined in: [packages/sdk/src/proofs/interface.ts:114](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L114)

Amount received

***

### txHash

> **txHash**: `` `0x${string}` ``

Defined in: [packages/sdk/src/proofs/interface.ts:116](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L116)

Transaction hash on destination chain

***

### blockNumber

> **blockNumber**: `bigint`

Defined in: [packages/sdk/src/proofs/interface.ts:118](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L118)

Block number containing the transaction

***

### signature

> **signature**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:120](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L120)

Oracle signature (threshold signature for multi-oracle)
