[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / OracleAttestation

# Interface: OracleAttestation

Defined in: [packages/sdk/src/proofs/interface.ts:98](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L98)

Oracle attestation for cross-chain verification

## Properties

### recipient

> **recipient**: `` `0x${string}` ``

Defined in: [packages/sdk/src/proofs/interface.ts:100](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L100)

Recipient who received funds

***

### amount

> **amount**: `bigint`

Defined in: [packages/sdk/src/proofs/interface.ts:102](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L102)

Amount received

***

### txHash

> **txHash**: `` `0x${string}` ``

Defined in: [packages/sdk/src/proofs/interface.ts:104](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L104)

Transaction hash on destination chain

***

### blockNumber

> **blockNumber**: `bigint`

Defined in: [packages/sdk/src/proofs/interface.ts:106](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L106)

Block number containing the transaction

***

### signature

> **signature**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:108](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L108)

Oracle signature (threshold signature for multi-oracle)
