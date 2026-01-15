# @sip-protocol/react-native

React Native SDK for Shielded Intents Protocol - privacy on iOS/Android.

## Installation

```bash
npm install @sip-protocol/react-native @sip-protocol/sdk

# Required peer dependencies
npm install react react-native

# Optional: For secure key storage (recommended for production)
npm install react-native-keychain

# Optional: For clipboard functionality
npm install @react-native-clipboard/clipboard
```

## Features

- **Mobile-optimized hooks** for stealth addresses, transfers, and payment scanning
- **Secure key storage** via iOS Keychain and Android Keystore
- **Biometric authentication** support for key access
- **Native clipboard** integration
- **Same API** as `@sip-protocol/react` with mobile-specific enhancements

## Quick Start

```tsx
import {
  useStealthAddress,
  useStealthTransfer,
  useScanPayments,
  SecureStorage,
} from '@sip-protocol/react-native'

function ReceiveScreen() {
  const {
    metaAddress,
    stealthAddress,
    copyToClipboard,
    saveToKeychain,
  } = useStealthAddress('solana', {
    autoSave: true,
    requireBiometrics: true,
  })

  return (
    <View>
      <Text>Share this address:</Text>
      <Text selectable>{metaAddress}</Text>

      <TouchableOpacity onPress={copyToClipboard}>
        <Text>Copy to Clipboard</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={saveToKeychain}>
        <Text>Save to Keychain</Text>
      </TouchableOpacity>
    </View>
  )
}
```

## Hooks

### useStealthAddress

Generate and manage stealth addresses with secure storage.

```tsx
const {
  metaAddress,        // Encoded meta-address for sharing
  stealthAddress,     // One-time stealth address
  spendingPrivateKey, // For claiming (handle securely!)
  viewingPrivateKey,  // For scanning
  isGenerating,       // Loading state
  error,              // Error if any
  regenerate,         // Generate new stealth address
  copyToClipboard,    // Copy to native clipboard
  saveToKeychain,     // Save keys securely
  loadFromKeychain,   // Load keys from storage
} = useStealthAddress('solana', {
  autoSave: false,         // Auto-save on generation
  requireBiometrics: true, // Require FaceID/TouchID
  walletId: 'main',        // Storage identifier
})
```

### useStealthTransfer

Execute private SPL token transfers.

```tsx
const {
  transfer,
  status,    // 'idle' | 'preparing' | 'signing' | 'sending' | 'confirming' | 'success' | 'error'
  error,
  isLoading,
  reset,
} = useStealthTransfer({
  connection,
  wallet: walletAdapter,
})

// Send private payment
const result = await transfer({
  recipientMetaAddress: 'sip:solana:...',
  amount: 1000000n, // 1 USDC
  mint: USDC_MINT,
})

if (result.success) {
  Alert.alert('Success', `Sent to ${result.stealthAddress}`)
}
```

### useScanPayments

Scan for incoming private payments.

```tsx
const {
  payments,   // Array of received payments
  isScanning,
  scan,       // (viewingKey, spendingPubKey) => Promise<void>
  claim,      // (signature, spendingKey, destination) => Promise<string>
  claimAll,   // (spendingKey, destination) => Promise<string[]>
  clear,
} = useScanPayments({
  connection,
  provider: heliusProvider, // Optional, recommended for efficiency
})

// Scan for payments
await scan(viewingPrivateKey, spendingPublicKey)

// Claim a payment
await claim(payment.signature, spendingPrivateKey, myWalletAddress)
```

## Secure Storage

The `SecureStorage` API provides platform-native secure storage:

- **iOS**: Keychain with optional biometric protection
- **Android**: Keystore with optional biometric protection

```tsx
import { SecureStorage } from '@sip-protocol/react-native'

// Store viewing key
await SecureStorage.setViewingKey('wallet-1', viewingKey, {
  requireBiometrics: true,
})

// Retrieve with biometric prompt
const key = await SecureStorage.getViewingKey('wallet-1', {
  requireBiometrics: true,
})

// Check biometrics support
const { available, biometryType } = await SecureStorage.getSupportedBiometrics()
// biometryType: 'FaceID' | 'TouchID' | 'Fingerprint' | 'None'

// Clear all keys on logout
await SecureStorage.clearAll()
```

## Platform Requirements

- iOS 13.0+
- Android API 23+
- React Native 0.71+

## Security Considerations

1. **Always use biometrics** for spending key access in production
2. **Never log private keys** - use `SecureStorage` for persistence
3. **Clear keys on logout** - call `SecureStorage.clearAll()`
4. **Use auto-lock** - keys are protected by device lock state

## License

MIT
