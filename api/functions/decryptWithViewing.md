[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / decryptWithViewing

# Function: decryptWithViewing()

> **decryptWithViewing**(`encrypted`, `viewingKey`): [`TransactionData`](../interfaces/TransactionData.md)

Defined in: [packages/sdk/src/privacy.ts:302](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/privacy.ts#L302)

Decrypt transaction data with viewing key

Performs authenticated decryption using XChaCha20-Poly1305.
The authentication tag is verified before returning data.

## Parameters

### encrypted

`EncryptedTransaction`

Encrypted transaction data

### viewingKey

[`ViewingKey`](../interfaces/ViewingKey.md)

Viewing key for decryption

## Returns

[`TransactionData`](../interfaces/TransactionData.md)

Decrypted transaction data

## Throws

If decryption fails (wrong key, tampered data, etc.)

## Example

```typescript
try {
  const data = decryptWithViewing(encrypted, viewingKey)
  console.log(`Amount: ${data.amount}`)
} catch (e) {
  console.error('Decryption failed - wrong key or tampered data')
}
```
