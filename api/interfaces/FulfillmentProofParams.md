[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / FulfillmentProofParams

# Interface: FulfillmentProofParams

Defined in: [packages/sdk/src/proofs/interface.ts:72](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L72)

Parameters for generating a Fulfillment Proof

Proves: solver delivered output >= minimum to correct recipient

## See

docs/specs/FULFILLMENT-PROOF.md

## Properties

### intentHash

> **intentHash**: `` `0x${string}` ``

Defined in: [packages/sdk/src/proofs/interface.ts:74](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L74)

Hash of the original intent (public)

***

### outputAmount

> **outputAmount**: `bigint`

Defined in: [packages/sdk/src/proofs/interface.ts:76](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L76)

Actual output amount delivered (private)

***

### outputBlinding

> **outputBlinding**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:78](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L78)

Blinding factor for output commitment (private)

***

### minOutputAmount

> **minOutputAmount**: `bigint`

Defined in: [packages/sdk/src/proofs/interface.ts:80](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L80)

Minimum required output from intent (public)

***

### recipientStealth

> **recipientStealth**: `` `0x${string}` ``

Defined in: [packages/sdk/src/proofs/interface.ts:82](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L82)

Recipient's stealth address (public)

***

### solverId

> **solverId**: `string`

Defined in: [packages/sdk/src/proofs/interface.ts:84](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L84)

Solver's identifier (public)

***

### solverSecret

> **solverSecret**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:86](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L86)

Solver's secret for authorization (private)

***

### oracleAttestation

> **oracleAttestation**: [`OracleAttestation`](OracleAttestation.md)

Defined in: [packages/sdk/src/proofs/interface.ts:88](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L88)

Oracle attestation of delivery (private)

***

### fulfillmentTime

> **fulfillmentTime**: `number`

Defined in: [packages/sdk/src/proofs/interface.ts:90](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L90)

Time of fulfillment (public)

***

### expiry

> **expiry**: `number`

Defined in: [packages/sdk/src/proofs/interface.ts:92](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L92)

Intent expiry (public)
