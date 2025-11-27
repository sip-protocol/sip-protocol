[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / createShieldedIntent

# Function: createShieldedIntent()

> **createShieldedIntent**(`params`, `options?`): `Promise`\<[`ShieldedIntent`](../interfaces/ShieldedIntent.md)\>

Defined in: [packages/sdk/src/intent.ts:276](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/intent.ts#L276)

Create a new shielded intent

## Parameters

### params

[`CreateIntentParams`](../interfaces/CreateIntentParams.md)

Intent creation parameters

### options?

[`CreateIntentOptions`](../interfaces/CreateIntentOptions.md)

Optional configuration (sender address, proof provider)

## Returns

`Promise`\<[`ShieldedIntent`](../interfaces/ShieldedIntent.md)\>

Promise resolving to the shielded intent

## Example

```typescript
// Without proof provider (proofs need to be attached later)
const intent = await createShieldedIntent(params)

// With proof provider (proofs generated automatically for SHIELDED/COMPLIANT)
const intent = await createShieldedIntent(params, {
  senderAddress: wallet.address,
  proofProvider: mockProvider,
})
```
