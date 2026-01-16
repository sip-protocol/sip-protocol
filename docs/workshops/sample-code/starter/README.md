# SIP Workshop Starter Code

Basic wallet UI template for the hands-on workshop.

## Setup

```bash
npm install
cp .env.example .env.local
# Add your Helius API key to .env.local
npm run dev
```

## Structure

```
src/
├── app/
│   └── page.tsx          # Main wallet UI
├── components/
│   ├── WalletButton.tsx  # Connect wallet
│   ├── SendForm.tsx      # Payment form
│   └── PaymentsList.tsx  # Incoming payments
└── hooks/
    ├── usePrivateAddress.ts  # TODO: Exercise 1
    ├── usePrivateSend.ts     # TODO: Exercise 2
    └── usePrivateReceive.ts  # TODO: Exercise 3
```

## Exercise Files

Complete the TODOs in the hooks directory following the hands-on tutorial.

## Solution

See `../solution/` for complete implementation.
