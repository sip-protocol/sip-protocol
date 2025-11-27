[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZcashSendRecipient

# Interface: ZcashSendRecipient

Defined in: packages/types/dist/index.d.ts:1127

Recipient for z_sendmany

## Properties

### address

> **address**: `string`

Defined in: packages/types/dist/index.d.ts:1129

Recipient address (t-addr, z-addr, or unified)

***

### amount

> **amount**: `number`

Defined in: packages/types/dist/index.d.ts:1131

Amount in ZEC

***

### memo?

> `optional` **memo**: `string`

Defined in: packages/types/dist/index.d.ts:1133

Optional memo (hex, for shielded recipients only)
