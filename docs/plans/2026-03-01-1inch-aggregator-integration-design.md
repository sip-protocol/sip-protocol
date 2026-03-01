# 1inch Aggregator Integration Design (#812)

## Context

SIPSwapRouter currently supports Uniswap V3 only. Adding 1inch aggregation gives access to 200+ liquidity sources with better price discovery. The architecture extends the existing contract with a generic aggregator swap function that works with any DEX aggregator (1inch now, 0x/Paraswap/CoW later).

## Architecture

```
User/SDK                          On-Chain
────────                          ────────
1. Generate stealth address
2. Call 1inch API with
   destReceiver=stealth
3. Get optimized calldata    →    SIPSwapRouter.privateAggregatorSwap()
                                    4. Validate privacy params
                                    5. Verify router whitelisted
                                    6. Decode calldata → verify dstReceiver == stealth
                                    7. Deduct SIP fee from input
                                    8. Approve aggregator, forward calldata
                                    9. Verify amountOut >= minimum
                                   10. Record swap + emit EIP-5564 Announcement
                                       ↓
                              1inch Router → DEX pools → stealth address
```

## On-Chain Changes (SIPSwapRouter.sol)

### New State

```solidity
mapping(address => bool) public approvedRouters;
```

### New Struct

```solidity
struct AggregatorSwapParams {
    address router;            // Must be whitelisted (e.g., 1inch V6)
    bytes swapCalldata;        // Pre-built calldata from aggregator API
    address tokenIn;           // address(0) for ETH
    address tokenOut;          // For record-keeping
    uint256 amountIn;          // Input amount (ignored for ETH, uses msg.value)
    uint256 amountOutMinimum;  // Slippage protection (verified post-swap)
    address stealthRecipient;  // Verified against calldata dstReceiver
    bytes32 commitment;
    bytes32 ephemeralPubKey;
    bytes32 viewingKeyHash;
    bytes encryptedAmount;
    uint256 deadline;
}
```

### New Functions

```solidity
function privateAggregatorSwap(AggregatorSwapParams calldata params)
    external payable whenNotPaused nonReentrant returns (uint256 swapId);

function setRouterApproval(address router, bool approved) external onlyOwner;
```

### Security Validations

1. **Router whitelist** — only approved aggregator addresses
2. **Function selector whitelist** — only `swap()` (0x12aa3caf) allowed
3. **Recipient verification** — decode `SwapDescription.dstReceiver` from calldata, must match `stealthRecipient`
4. **Output verification** — check stealth recipient's token balance increased >= `amountOutMinimum`
5. **Exact approvals** — approve exact amount, reset to 0 after (safe approve pattern)
6. **Flags validation** — reject `REQUIRES_EXTRA_ETH` flag to prevent value extraction

### New Errors

```solidity
error RouterNotApproved();
error InvalidSelector();
error RecipientMismatch();
error InsufficientOutput();
```

### New Events

```solidity
event RouterApprovalUpdated(address indexed router, bool approved);
```

## 1inch V6 Router Details

- **Address:** `0x111111125421cA6dc452d289314280a0f8842A65` (same on all EVM chains via CREATE2)
- **Swap selector:** `0x12aa3caf` = `swap(address,(address,address,address,address,uint256,uint256,uint256,bytes),bytes)`
- **SwapDescription.dstReceiver** = stealth address (output goes directly there)
- **API:** `GET https://api.1inch.dev/swap/v6.0/{chainId}/swap`
- **Auth:** Bearer token from portal.1inch.dev

## SDK Changes (packages/sdk)

### New File: `packages/sdk/src/adapters/oneinch.ts`

```typescript
export class OneInchAdapter {
  constructor(apiKey: string, chainId: number)

  async getQuote(params: {
    src: string, dst: string, amount: bigint
  }): Promise<OneInchQuote>

  async getSwapCalldata(params: {
    src: string, dst: string, amount: bigint,
    from: string,           // SIPSwapRouter contract address
    destReceiver: string,   // stealth address
    slippage: number
  }): Promise<OneInchSwapData>
}
```

### Supported Chains

| Network | Chain ID | 1inch Router |
|---------|----------|-------------|
| Ethereum | 1 | `0x111111125421cA6dc452d289314280a0f8842A65` |
| Sepolia | 11155111 | `0x111111125421cA6dc452d289314280a0f8842A65` |
| Arbitrum | 42161 | `0x111111125421cA6dc452d289314280a0f8842A65` |
| Base | 8453 | `0x111111125421cA6dc452d289314280a0f8842A65` |
| Optimism | 10 | `0x111111125421cA6dc452d289314280a0f8842A65` |

## Tests

~20 new Foundry tests in `SIPSwapRouterAggregatorTest`:

| Category | Tests |
|----------|-------|
| Router approval | setRouterApproval, reverts for non-owner, emits event |
| Aggregator swap (ETH) | success, fee deduction, events, record |
| Aggregator swap (ERC20) | success, fee deduction |
| Security | unapproved router reverts, invalid selector reverts, recipient mismatch reverts, insufficient output reverts |
| Edge cases | zero amount, expired deadline, paused |

Mock: `MockAggregatorRouter` — simulates 1inch `swap()` function, configurable output.

## Deployment

Option A (preferred): Call `setRouterApproval()` on existing deployed SIPSwapRouter — requires redeployment since we're adding new state/functions.

Option B: Redeploy SIPSwapRouter with aggregator support, call `setRouterApproval(0x111111125421cA6dc452d289314280a0f8842A65, true)`.

## File Changes

**Modify:**
- `contracts/sip-ethereum/src/SIPSwapRouter.sol` — add aggregator swap + router whitelist
- `contracts/sip-ethereum/test/helpers/TestSetup.sol` — add MockAggregatorRouter
- `contracts/sip-ethereum/test/SIPSwapRouter.t.sol` — add aggregator test contract

**Create:**
- `packages/sdk/src/adapters/oneinch.ts` — OneInchAdapter class
- `packages/sdk/tests/adapters/oneinch.test.ts` — adapter tests
