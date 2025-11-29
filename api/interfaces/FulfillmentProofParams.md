[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / FulfillmentProofParams

# Interface: FulfillmentProofParams

Defined in: [packages/sdk/src/proofs/interface.ts:84](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L84)

Parameters for generating a Fulfillment Proof

Proves: solver delivered output >= minimum to correct recipient

## See

docs/specs/FULFILLMENT-PROOF.md

## Properties

### intentHash

> **intentHash**: `` `0x${string}` ``

Defined in: [packages/sdk/src/proofs/interface.ts:86](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L86)

Hash of the original intent (public)

***

### outputAmount

> **outputAmount**: `bigint`

Defined in: [packages/sdk/src/proofs/interface.ts:88](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L88)

Actual output amount delivered (private)

***

### outputBlinding

> **outputBlinding**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:90](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L90)

Blinding factor for output commitment (private)

***

### minOutputAmount

> **minOutputAmount**: `bigint`

Defined in: [packages/sdk/src/proofs/interface.ts:92](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L92)

Minimum required output from intent (public)

***

### recipientStealth

> **recipientStealth**: `` `0x${string}` ``

Defined in: [packages/sdk/src/proofs/interface.ts:94](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L94)

Recipient's stealth address (public)

***

### solverId

> **solverId**: `string`

Defined in: [packages/sdk/src/proofs/interface.ts:96](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L96)

Solver's identifier (public)

***

### solverSecret

> **solverSecret**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:98](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L98)

Solver's secret for authorization (private)

***

### oracleAttestation

> **oracleAttestation**: [`OracleAttestation`](OracleAttestation.md)

Defined in: [packages/sdk/src/proofs/interface.ts:100](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L100)

Oracle attestation of delivery (private)

***

### fulfillmentTime

> **fulfillmentTime**: `number`

Defined in: [packages/sdk/src/proofs/interface.ts:102](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L102)

Time of fulfillment (public)

***

### expiry

> **expiry**: `number`

Defined in: [packages/sdk/src/proofs/interface.ts:104](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L104)

Intent expiry (public)
