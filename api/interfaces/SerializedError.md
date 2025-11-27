[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SerializedError

# Interface: SerializedError

Defined in: [packages/sdk/src/errors.ts:83](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/errors.ts#L83)

Serialized error format for logging and transmission

## Properties

### name

> **name**: `string`

Defined in: [packages/sdk/src/errors.ts:84](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/errors.ts#L84)

***

### code

> **code**: [`ErrorCode`](../enumerations/ErrorCode.md)

Defined in: [packages/sdk/src/errors.ts:85](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/errors.ts#L85)

***

### message

> **message**: `string`

Defined in: [packages/sdk/src/errors.ts:86](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/errors.ts#L86)

***

### field?

> `optional` **field**: `string`

Defined in: [packages/sdk/src/errors.ts:87](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/errors.ts#L87)

***

### context?

> `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [packages/sdk/src/errors.ts:88](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/errors.ts#L88)

***

### cause?

> `optional` **cause**: `string`

Defined in: [packages/sdk/src/errors.ts:89](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/errors.ts#L89)

***

### stack?

> `optional` **stack**: `string`

Defined in: [packages/sdk/src/errors.ts:90](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/errors.ts#L90)

***

### timestamp

> **timestamp**: `string`

Defined in: [packages/sdk/src/errors.ts:91](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/errors.ts#L91)
