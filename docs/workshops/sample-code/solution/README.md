# SIP Workshop Solution Code

Complete implementation for the hands-on workshop exercises.

## This is the solution!

If you're doing the workshop, try the exercises first before looking here.

## Structure

```
src/hooks/
├── usePrivateAddress.ts  # Exercise 1 Solution
├── usePrivateSend.ts     # Exercise 2 Solution
└── usePrivateReceive.ts  # Exercise 3 Solution
```

## Running the Solution

```bash
npm install
cp .env.example .env.local
# Add your Helius API key
npm run dev
```

## Key Concepts Demonstrated

1. **Stealth Meta-Address Generation**: Creating shareable private addresses
2. **One-Time Address Derivation**: Generating unique addresses per payment
3. **Payment Scanning**: Finding incoming payments with viewing key
4. **Fund Claiming**: Deriving spending key and transferring

## Next Steps

After completing the workshop, explore:
- [SDK Quick-Start Guides](../../guides/)
- [Full SDK Documentation](https://docs.sip-protocol.org)
- [GitHub Examples](https://github.com/sip-protocol/examples)
