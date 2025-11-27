[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / createZcashClient

# Function: createZcashClient()

> **createZcashClient**(`config`): [`ZcashRPCClient`](../classes/ZcashRPCClient.md)

Defined in: [packages/sdk/src/zcash/rpc-client.ts:621](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/zcash/rpc-client.ts#L621)

Create a Zcash RPC client

## Parameters

### config

[`ZcashConfig`](../interfaces/ZcashConfig.md)

Client configuration

## Returns

[`ZcashRPCClient`](../classes/ZcashRPCClient.md)

ZcashRPCClient instance

## Security

IMPORTANT: Always use HTTPS in production environments.
HTTP Basic Auth transmits credentials in cleartext without TLS/HTTPS.
Configure your zcashd node with TLS certificates and use https:// URLs.

## Example

```typescript
// ✅ Production (HTTPS)
const client = createZcashClient({
  host: 'https://your-node.com',
  port: 8232,
  username: process.env.ZCASH_RPC_USER,
  password: process.env.ZCASH_RPC_PASS,
})

// ⚠️ Development only (HTTP)
const testClient = createZcashClient({
  host: '127.0.0.1',
  port: 18232,
  username: 'test',
  password: 'test',
  testnet: true,
})
```
