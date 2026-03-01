# Gelato Relayer Integration — Design (#810)

## Problem

Stealth addresses receive funds but have zero ETH for gas. Recipients can't claim transfers or move funds without paying gas, breaking the privacy UX.

## Solution

Integrate Gelato Relay for gasless transaction submission. Two modes:

### Mode 1: SIP-Sponsored (`sponsoredCall`)

```
Recipient signs tx offline → SDK → Gelato API (SIP API key) → Contract
Gas paid from SIP's Gelato Gas Tank. No contract changes needed.
```

- **Pros:** Zero contract changes, simple SDK integration, good for adoption
- **Cons:** SIP bears gas cost, needs Gas Tank funding, rate limiting required
- **Use:** Default mode, small claims, onboarding

### Mode 2: Sync Fee (`callWithSyncFee`)

```
Recipient signs tx offline → SDK → Gelato API → SIPRelayer contract
SIPRelayer: receive funds → deduct Gelato fee → forward remainder to recipient
```

- **Pros:** Self-sustaining, no Gas Tank dependency, scales infinitely
- **Cons:** New contract deployment, fee reduces claim amount, more complex
- **Use:** Large claims, when Gas Tank is low, user preference

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SDK (GelatoRelayAdapter)                                    │
│                                                              │
│  1. Recipient derives stealth private key                    │
│  2. Signs claim tx + sweep tx offline                        │
│  3. Chooses mode: sponsored (default) or syncFee             │
│  4. Submits to Gelato Relay SDK                              │
│  5. Tracks task status via polling/websocket                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
    sponsoredCall              callWithSyncFee
              │                         │
    Gelato submits tx          Gelato submits tx
    to SIPPrivacy directly     to SIPRelayer contract
              │                         │
    Gas Tank pays              SIPRelayer:
                                 - receives funds from stealth
                                 - deducts Gelato fee
                                 - forwards rest to recipient
```

## Contract: SIPRelayer.sol (~120 LOC)

Inherits `GelatoRelayContext` from `@gelatonetwork/relay-context`. Wraps the claim+sweep flow for `callWithSyncFee` mode.

```solidity
contract SIPRelayer is GelatoRelayContext, ReentrancyGuard {
    SIPPrivacy public immutable sipPrivacy;
    address public owner;
    bool public paused;

    // Relayed claim for ETH transfers
    // Stealth key holder signs EIP-712 permit authorizing the relay
    function relayedClaimETH(
        uint256 transferId,
        bytes32 nullifier,
        bytes calldata proof,
        address recipient,
        uint256 maxFee
    ) external onlyGelatoRelay nonReentrant whenNotPaused {
        // 1. Mark claim on SIPPrivacy
        sipPrivacy.claimTransfer(transferId, nullifier, proof, recipient);

        // 2. Pay Gelato fee (capped)
        _transferRelayFeeCapped(maxFee);

        // 3. Forward remaining ETH to recipient
        // (stealth address must have sent ETH to this contract first)
        payable(recipient).transfer(address(this).balance);
    }

    // Relayed claim for ERC20 transfers
    function relayedClaimToken(
        uint256 transferId,
        bytes32 nullifier,
        bytes calldata proof,
        address recipient,
        address token,
        uint256 maxFee
    ) external onlyGelatoRelay nonReentrant whenNotPaused {
        sipPrivacy.claimTokenTransfer(transferId, nullifier, proof, recipient);
        _transferRelayFeeCapped(maxFee);
        // Forward remaining tokens
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(recipient, balance);
    }

    // Admin
    function setPaused(bool _paused) external onlyOwner { ... }
    function rescueTokens(address token) external onlyOwner { ... }

    receive() external payable {}
}
```

**Two-tx flow for callWithSyncFee:**
1. Stealth key signs: send ETH/tokens from stealth address → SIPRelayer
2. SIPRelayer.relayedClaimETH/Token: claim + pay Gelato + forward remainder

Both txs submitted in a Gelato batch or sequentially.

## SDK: GelatoRelayAdapter

```typescript
class GelatoRelayAdapter {
  constructor(config: {
    apiKey?: string          // For sponsoredCall (SIP's key)
    chainId: number
    sipPrivacyAddress: string
    sipRelayerAddress?: string  // For callWithSyncFee
  })

  // Gasless claim + sweep via sponsored relay
  async sponsoredClaim(params: {
    transferId: bigint
    nullifier: string
    proof: string
    recipient: string
    stealthPrivateKey: string  // To sign the sweep tx
  }): Promise<RelayResult>

  // Gasless claim + sweep with fee deducted from amount
  async syncFeeClaim(params: {
    transferId: bigint
    nullifier: string
    proof: string
    recipient: string
    stealthPrivateKey: string
    feeToken: string
    maxFee: bigint
  }): Promise<RelayResult>

  // Track relay task status
  async getTaskStatus(taskId: string): Promise<TaskStatus>
}

interface RelayResult {
  taskId: string
  mode: 'sponsored' | 'syncFee'
}
```

## Fee Model

| Mode | Who Pays | Source | Limit |
|------|----------|--------|-------|
| Sponsored | SIP Protocol | Gelato Gas Tank (USDC) | Rate limit: 10 claims/day/address |
| Sync Fee | Recipient | Deducted from claim amount | maxFee cap (user-specified) |

## Chains

All target L2s supported by Gelato Relay:
- Ethereum Sepolia (testnet)
- Base, Arbitrum, Optimism (production)

## Testing

- Unit tests for SIPRelayer (Foundry, ~15 tests)
- Mock GelatoRelay in SDK tests (vitest, ~10 tests)
- Integration test on Sepolia with real Gelato relay

## Files

**Create:**
| File | LOC |
|------|-----|
| `contracts/sip-ethereum/src/SIPRelayer.sol` | ~120 |
| `contracts/sip-ethereum/test/SIPRelayer.t.sol` | ~250 |
| `contracts/sip-ethereum/script/DeploySIPRelayer.s.sol` | ~50 |
| `packages/sdk/src/adapters/gelato-relay.ts` | ~150 |
| `packages/sdk/tests/adapters/gelato-relay.test.ts` | ~100 |

**Modify:**
| File | Change |
|------|--------|
| `packages/sdk/src/adapters/index.ts` | Export GelatoRelayAdapter |
| `contracts/sip-ethereum/test/helpers/TestSetup.sol` | Add MockGelatoRelay |
