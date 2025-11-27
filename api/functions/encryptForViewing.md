[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / encryptForViewing

# Function: encryptForViewing()

> **encryptForViewing**(`data`, `viewingKey`): `EncryptedTransaction`

Defined in: [packages/sdk/src/privacy.ts:229](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/privacy.ts#L229)

Encrypt transaction data for viewing key holders

Uses XChaCha20-Poly1305 authenticated encryption with:
- 24-byte random nonce (nonce-misuse resistant)
- HKDF-derived encryption key
- 16-byte authentication tag (included in ciphertext)

## Parameters

### data

[`TransactionData`](../interfaces/TransactionData.md)

Transaction data to encrypt

### viewingKey

[`ViewingKey`](../interfaces/ViewingKey.md)

Viewing key for encryption

## Returns

`EncryptedTransaction`

Encrypted transaction with nonce and key hash

## Example

```typescript
const encrypted = encryptForViewing(
  { sender: '0x...', recipient: '0x...', amount: '100', timestamp: 123 },
  viewingKey
)
// encrypted.ciphertext contains the encrypted data
// encrypted.nonce is needed for decryption
// encrypted.viewingKeyHash identifies which key can decrypt
```
