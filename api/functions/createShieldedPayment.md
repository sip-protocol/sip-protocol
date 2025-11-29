[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / createShieldedPayment

# Function: createShieldedPayment()

> **createShieldedPayment**(`params`, `options?`): `Promise`\<[`ShieldedPayment`](../interfaces/ShieldedPayment.md)\>

Defined in: [packages/sdk/src/payment/payment.ts:341](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/payment.ts#L341)

Create a shielded payment

## Parameters

### params

[`CreatePaymentParams`](../interfaces/CreatePaymentParams.md)

Payment creation parameters

### options?

[`CreatePaymentOptions`](../interfaces/CreatePaymentOptions.md)

Optional configuration

## Returns

`Promise`\<[`ShieldedPayment`](../interfaces/ShieldedPayment.md)\>

Promise resolving to the shielded payment
