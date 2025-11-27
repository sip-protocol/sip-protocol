[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SIPConfig

# Interface: SIPConfig

Defined in: [packages/sdk/src/sip.ts:33](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L33)

SIP SDK configuration

## Properties

### network

> **network**: `"mainnet"` \| `"testnet"`

Defined in: [packages/sdk/src/sip.ts:35](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L35)

Network: mainnet or testnet

***

### defaultPrivacy?

> `optional` **defaultPrivacy**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: [packages/sdk/src/sip.ts:37](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L37)

Default privacy level

***

### rpcEndpoints?

> `optional` **rpcEndpoints**: `Partial`\<`Record`\<[`ChainId`](../type-aliases/ChainId.md), `string`\>\>

Defined in: [packages/sdk/src/sip.ts:39](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L39)

RPC endpoints for chains

***

### proofProvider?

> `optional` **proofProvider**: [`ProofProvider`](ProofProvider.md)

Defined in: [packages/sdk/src/sip.ts:56](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/sip.ts#L56)

Proof provider for ZK proof generation

If not provided, proof generation will not be available.
Use MockProofProvider for testing, NoirProofProvider for production.

#### Example

```typescript
import { MockProofProvider } from '@sip-protocol/sdk'

const sip = new SIP({
  network: 'testnet',
  proofProvider: new MockProofProvider(),
})
```
