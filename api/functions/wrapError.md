[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / wrapError

# Function: wrapError()

> **wrapError**(`error`, `message`, `code`, `context?`): [`SIPError`](../classes/SIPError.md)

Defined in: [packages/sdk/src/errors.ts:448](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/errors.ts#L448)

Wrap an unknown error as a SIPError

Useful for catching and re-throwing with additional context.

## Parameters

### error

`unknown`

### message

`string`

### code

[`ErrorCode`](../enumerations/ErrorCode.md) = `ErrorCode.INTERNAL`

### context?

`Record`\<`string`, `unknown`\>

## Returns

[`SIPError`](../classes/SIPError.md)

## Example

```typescript
try {
  await riskyOperation()
} catch (e) {
  throw wrapError(e, 'Operation failed', ErrorCode.INTERNAL)
}
```
