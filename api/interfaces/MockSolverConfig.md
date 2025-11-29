[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / MockSolverConfig

# Interface: MockSolverConfig

Defined in: [packages/sdk/src/solver/mock-solver.ts:26](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L26)

Configuration for MockSolver

## Properties

### name?

> `optional` **name**: `string`

Defined in: [packages/sdk/src/solver/mock-solver.ts:28](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L28)

Solver name

***

### supportedChains?

> `optional` **supportedChains**: [`ChainId`](../type-aliases/ChainId.md)[]

Defined in: [packages/sdk/src/solver/mock-solver.ts:30](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L30)

Supported chains

***

### feePercent?

> `optional` **feePercent**: `number`

Defined in: [packages/sdk/src/solver/mock-solver.ts:32](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L32)

Base fee percentage (0-1)

***

### executionDelay?

> `optional` **executionDelay**: `number`

Defined in: [packages/sdk/src/solver/mock-solver.ts:34](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L34)

Simulated execution time in ms

***

### failureRate?

> `optional` **failureRate**: `number`

Defined in: [packages/sdk/src/solver/mock-solver.ts:36](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L36)

Failure rate for testing (0-1)

***

### spreadPercent?

> `optional` **spreadPercent**: `number`

Defined in: [packages/sdk/src/solver/mock-solver.ts:38](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L38)

Quote spread percentage (0-1)
