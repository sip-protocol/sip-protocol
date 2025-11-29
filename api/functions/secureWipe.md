[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / secureWipe

# Function: secureWipe()

> **secureWipe**(`buffer`): `void`

Defined in: [packages/sdk/src/secure-memory.ts:67](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/secure-memory.ts#L67)

Securely wipe a buffer containing sensitive data

This performs a defense-in-depth wipe:
1. Overwrite with random data (defeats simple memory scrapers)
2. Zero the buffer (standard cleanup)

Note: Due to JavaScript's garbage collection and potential JIT
optimizations, this cannot guarantee complete erasure. However,
it provides significant improvement over leaving secrets in memory.

## Parameters

### buffer

`Uint8Array`

The buffer to wipe (modified in place)

## Returns

`void`

## Example

```typescript
const secretKey = randomBytes(32)
// ... use the key ...
secureWipe(secretKey) // Clean up when done
```
