[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashSendRecipient

# Interface: ZcashSendRecipient

Defined in: packages/types/dist/index.d.ts:1157

Recipient for z_sendmany

## Properties

### address

> **address**: `string`

Defined in: packages/types/dist/index.d.ts:1159

Recipient address (t-addr, z-addr, or unified)

***

### amount

> **amount**: `number`

Defined in: packages/types/dist/index.d.ts:1161

Amount in ZEC

***

### memo?

> `optional` **memo**: `string`

Defined in: packages/types/dist/index.d.ts:1163

Optional memo (hex, for shielded recipients only)
