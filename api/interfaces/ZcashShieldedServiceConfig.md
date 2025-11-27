[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashShieldedServiceConfig

# Interface: ZcashShieldedServiceConfig

Defined in: [packages/sdk/src/zcash/shielded-service.ts:46](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L46)

Configuration for ZcashShieldedService

## Properties

### rpcConfig

> **rpcConfig**: [`ZcashConfig`](ZcashConfig.md)

Defined in: [packages/sdk/src/zcash/shielded-service.ts:48](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L48)

RPC client configuration

***

### defaultAccount?

> `optional` **defaultAccount**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:50](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L50)

Default account to use (default: 0)

***

### defaultMinConf?

> `optional` **defaultMinConf**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:52](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L52)

Default minimum confirmations (default: 1)

***

### operationPollInterval?

> `optional` **operationPollInterval**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:54](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L54)

Poll interval for operations in ms (default: 1000)

***

### operationTimeout?

> `optional` **operationTimeout**: `number`

Defined in: [packages/sdk/src/zcash/shielded-service.ts:56](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/shielded-service.ts#L56)

Operation timeout in ms (default: 300000 = 5 min)
