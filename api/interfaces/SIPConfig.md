[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SIPConfig

# Interface: SIPConfig

Defined in: [packages/sdk/src/sip.ts:37](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L37)

SIP SDK configuration

## Properties

### network

> **network**: `"mainnet"` \| `"testnet"`

Defined in: [packages/sdk/src/sip.ts:39](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L39)

Network: mainnet or testnet

***

### mode?

> `optional` **mode**: `"demo"` \| `"production"`

Defined in: [packages/sdk/src/sip.ts:44](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L44)

Mode: 'demo' for mock data, 'production' for real NEAR Intents

#### Default

```ts
'demo'
```

***

### defaultPrivacy?

> `optional` **defaultPrivacy**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: [packages/sdk/src/sip.ts:46](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L46)

Default privacy level

***

### rpcEndpoints?

> `optional` **rpcEndpoints**: `Partial`\<`Record`\<[`ChainId`](../type-aliases/ChainId.md), `string`\>\>

Defined in: [packages/sdk/src/sip.ts:48](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L48)

RPC endpoints for chains

***

### proofProvider?

> `optional` **proofProvider**: [`ProofProvider`](ProofProvider.md)

Defined in: [packages/sdk/src/sip.ts:65](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L65)

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

***

### intentsAdapter?

> `optional` **intentsAdapter**: [`NEARIntentsAdapterConfig`](NEARIntentsAdapterConfig.md) \| [`NEARIntentsAdapter`](../classes/NEARIntentsAdapter.md)

Defined in: [packages/sdk/src/sip.ts:82](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L82)

NEAR Intents adapter configuration

Required for production mode. Provides connection to 1Click API.

#### Example

```typescript
const sip = new SIP({
  network: 'mainnet',
  mode: 'production',
  intentsAdapter: {
    jwtToken: process.env.NEAR_INTENTS_JWT,
  },
})
```
