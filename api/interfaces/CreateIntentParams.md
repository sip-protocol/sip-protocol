[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / CreateIntentParams

# Interface: CreateIntentParams

Defined in: packages/types/dist/index.d.ts:250

Parameters for creating a new shielded intent

## Properties

### input

> **input**: `IntentInput`

Defined in: packages/types/dist/index.d.ts:252

Input specification

***

### output

> **output**: `IntentOutput`

Defined in: packages/types/dist/index.d.ts:254

Output specification

***

### privacy

> **privacy**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: packages/types/dist/index.d.ts:256

Privacy level

***

### recipientMetaAddress?

> `optional` **recipientMetaAddress**: `string`

Defined in: packages/types/dist/index.d.ts:258

Recipient's stealth meta-address (for shielded modes)

***

### viewingKey?

> `optional` **viewingKey**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:260

Viewing key (for compliant mode)

***

### ttl?

> `optional` **ttl**: `number`

Defined in: packages/types/dist/index.d.ts:262

Time-to-live in seconds (default: 300)
