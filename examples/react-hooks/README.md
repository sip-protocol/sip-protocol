# SIP Protocol React Hooks Examples

Complete examples demonstrating `@sip-protocol/react` hooks for building private payment UIs.

## Quick Start

```bash
# Install dependencies
npm install @sip-protocol/react @sip-protocol/sdk @solana/web3.js @solana/wallet-adapter-react @solana/wallet-adapter-wallets
```

## Examples

### 1. Send Private Tokens (`useStealthTransfer`)

[SendPrivateForm.tsx](./SendPrivateForm.tsx) — Complete form for sending SPL tokens to stealth addresses.

Features:
- Wallet connection integration
- Fee estimation
- Transaction status tracking
- Explorer links

### 2. Receive Private Payments (`useScanPayments`)

[ReceivePayments.tsx](./ReceivePayments.tsx) — Dashboard for scanning and claiming incoming payments.

Features:
- Auto-scanning with configurable interval
- Manual scan trigger
- Individual and batch claiming
- Unclaimed balance tracking

### 3. Generate Stealth Address (`useStealthAddress`)

[StealthAddressGenerator.tsx](./StealthAddressGenerator.tsx) — Generate and display stealth meta-addresses.

Features:
- Key generation
- QR code display
- Copy to clipboard
- Key export/backup

### 4. Complete Private Wallet (`PrivateWallet.tsx`)

[PrivateWallet.tsx](./PrivateWallet.tsx) — Full-featured wallet combining all hooks.

Features:
- Send and receive
- Transaction history
- Balance tracking
- Key management

## Usage

### Basic Setup

```tsx
import { SIPProvider } from '@sip-protocol/react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'

function App() {
  return (
    <ConnectionProvider endpoint="https://api.devnet.solana.com">
      <WalletProvider wallets={wallets}>
        <SIPProvider>
          <YourApp />
        </SIPProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
```

### Environment Variables

```env
# Solana RPC (Helius recommended for production)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_HELIUS_API_KEY=your-helius-key

# Optional: Default network
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

## Hook Reference

| Hook | Purpose |
|------|---------|
| `useStealthTransfer` | Send tokens to stealth addresses |
| `useScanPayments` | Scan for and claim incoming payments |
| `useStealthAddress` | Generate and manage stealth meta-addresses |
| `useViewingKey` | Manage viewing keys for compliance |
| `usePrivateSwap` | Private token swaps (coming soon) |

## License

MIT — SIP Protocol
