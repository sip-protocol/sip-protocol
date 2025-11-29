[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / PaymentBuilder

# Class: PaymentBuilder

Defined in: [packages/sdk/src/payment/payment.ts:64](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L64)

Builder class for creating shielded payments

Provides a fluent interface for constructing privacy-preserving payments.

## Constructors

### Constructor

> **new PaymentBuilder**(): `PaymentBuilder`

#### Returns

`PaymentBuilder`

## Methods

### token()

> **token**(`tokenOrSymbol`, `chain?`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:85](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L85)

Set the token to transfer

#### Parameters

##### tokenOrSymbol

Asset object or stablecoin symbol

[`Asset`](../interfaces/Asset.md) | [`StablecoinSymbol`](../type-aliases/StablecoinSymbol.md)

##### chain?

[`ChainId`](../type-aliases/ChainId.md)

Chain ID (required if using symbol)

#### Returns

`this`

***

### amount()

> **amount**(`amount`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:128](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L128)

Set the amount to transfer (in smallest units)

#### Parameters

##### amount

`bigint`

Amount in token's smallest units

#### Returns

`this`

***

### amountHuman()

> **amountHuman**(`amount`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:146](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L146)

Set the amount in human-readable format

#### Parameters

##### amount

`number`

Human-readable amount (e.g., 100.50)

#### Returns

`this`

***

### recipient()

> **recipient**(`metaAddress`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:163](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L163)

Set the recipient's stealth meta-address (for privacy modes)

#### Parameters

##### metaAddress

`string`

#### Returns

`this`

***

### recipientDirect()

> **recipientDirect**(`address`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:180](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L180)

Set the recipient's direct address (for transparent mode)

#### Parameters

##### address

`string`

#### Returns

`this`

***

### privacy()

> **privacy**(`level`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:197](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L197)

Set the privacy level

#### Parameters

##### level

[`PrivacyLevel`](../enumerations/PrivacyLevel.md)

#### Returns

`this`

***

### viewingKey()

> **viewingKey**(`key`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:213](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L213)

Set the viewing key (required for compliant mode)

#### Parameters

##### key

`` `0x${string}` ``

#### Returns

`this`

***

### destinationChain()

> **destinationChain**(`chain`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:221](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L221)

Set the destination chain (for cross-chain payments)

#### Parameters

##### chain

[`ChainId`](../type-aliases/ChainId.md)

#### Returns

`this`

***

### purpose()

> **purpose**(`purpose`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:237](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L237)

Set the payment purpose

#### Parameters

##### purpose

[`PaymentPurpose`](../type-aliases/PaymentPurpose.md)

#### Returns

`this`

***

### memo()

> **memo**(`memo`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:245](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L245)

Set an optional memo/reference

#### Parameters

##### memo

`string`

#### Returns

`this`

***

### ttl()

> **ttl**(`seconds`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:261](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L261)

Set time-to-live in seconds

#### Parameters

##### seconds

`number`

#### Returns

`this`

***

### sender()

> **sender**(`address`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:277](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L277)

Set the sender address

#### Parameters

##### address

`string`

#### Returns

`this`

***

### withProvider()

> **withProvider**(`provider`): `this`

Defined in: [packages/sdk/src/payment/payment.ts:285](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L285)

Set the proof provider

#### Parameters

##### provider

[`ProofProvider`](../interfaces/ProofProvider.md)

#### Returns

`this`

***

### build()

> **build**(): `Promise`\<[`ShieldedPayment`](../interfaces/ShieldedPayment.md)\>

Defined in: [packages/sdk/src/payment/payment.ts:293](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L293)

Build the shielded payment

#### Returns

`Promise`\<[`ShieldedPayment`](../interfaces/ShieldedPayment.md)\>
