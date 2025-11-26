# SIP Protocol - Manual Test Checklist

End-to-end testnet integration manual test checklist for verifying SIP Protocol functionality across all integrated chains.

## Environment Setup

### Prerequisites

- [ ] Node.js 18+ installed
- [ ] pnpm installed
- [ ] Testnet tokens acquired for each chain:
  - [ ] Solana devnet SOL (faucet: https://faucet.solana.com)
  - [ ] Sepolia ETH (faucet: https://sepoliafaucet.com)
  - [ ] NEAR testnet tokens (faucet: https://near-faucet.io)
  - [ ] Zcash testnet ZEC (faucet: https://faucet.testnet.z.cash)

### Environment Variables

```bash
# .env.test
NEAR_INTENTS_JWT=<your-jwt-token>
SOLANA_RPC_URL=https://api.devnet.solana.com
ETHEREUM_RPC_URL=https://rpc.sepolia.org
ZCASH_RPC_URL=http://localhost:18232
ZCASH_RPC_USER=<username>
ZCASH_RPC_PASS=<password>
```

---

## Test Scenarios

### 1. Cross-Chain Swap Flow (SOL → ZEC)

**Objective:** Complete a shielded swap from Solana to Zcash

#### Steps:

- [ ] **1.1** Connect Solana wallet (devnet)
  - Open demo app
  - Click "Connect Wallet"
  - Select Phantom/Solflare (devnet mode)
  - Verify wallet address displayed

- [ ] **1.2** Create shielded intent
  - Select input: SOL (Solana)
  - Enter amount: 0.1 SOL
  - Select output: ZEC (Zcash)
  - Set privacy level: SHIELDED
  - Click "Create Intent"
  - Verify intent ID generated

- [ ] **1.3** Submit to NEAR testnet
  - Intent automatically submitted
  - Verify status: "Pending"
  - Check NEAR transaction on explorer

- [ ] **1.4** Receive solver quote
  - Wait for quote (max 30 seconds)
  - Verify quote amount displayed
  - Verify fee displayed
  - Verify expiry time

- [ ] **1.5** Execute swap
  - Accept quote
  - Sign transaction in wallet
  - Wait for confirmation

- [ ] **1.6** Verify ZEC received
  - Check Zcash wallet balance
  - Verify amount matches quote (minus fees)
  - Verify received in shielded address

- [ ] **1.7** Confirm no privacy leakage
  - Check Solana explorer - no linked destination
  - Check NEAR explorer - only commitments visible
  - Check Zcash explorer - shielded transaction (no amounts)

**Expected Results:**
- Swap completes successfully
- ZEC received in shielded Zcash address
- Transaction data not linkable

---

### 2. Privacy Verification

**Objective:** Verify all privacy guarantees are maintained

#### Sender Privacy

- [ ] **2.1** Sender address not visible in intent
  - Create shielded intent
  - Export intent JSON
  - Verify no raw sender address
  - Verify only `senderCommitment` present

- [ ] **2.2** Multiple intents not linkable
  - Create 3 intents from same wallet
  - Compare `senderCommitment` values
  - Verify all different (unlinkable)

#### Amount Privacy

- [ ] **2.3** Amount hidden with commitment
  - Create intent with 1.0 SOL
  - Export intent JSON
  - Verify no raw amount visible
  - Verify `inputCommitment` present

- [ ] **2.4** Commitment verification
  - Note the input commitment
  - Cannot derive original amount from commitment
  - Only sender with blinding factor can open

#### Stealth Addresses

- [ ] **2.5** Unique stealth address per transaction
  - Send 3 transactions to same recipient
  - Verify 3 different receiving addresses
  - All received by same wallet

- [ ] **2.6** Stealth address unlinkability
  - Observer cannot link stealth addresses
  - Even with blockchain data

- [ ] **2.7** Refund uses fresh stealth address
  - Trigger a failed transaction
  - Verify refund goes to new stealth address
  - Not linked to original sender

---

### 3. Compliance Flow

**Objective:** Test COMPLIANT privacy mode with viewing keys

#### Setup

- [ ] **3.1** Generate master viewing key
  - Navigate to Compliance Settings
  - Generate viewing key for account
  - Note key hash

#### Transaction

- [ ] **3.2** Create compliant-mode intent
  - Select privacy: COMPLIANT
  - Verify viewing key attached
  - Complete transaction

- [ ] **3.3** Verify auditor access
  - Export viewing key for auditor
  - Auditor decrypts transaction details
  - Verify sender, amount, recipient visible

- [ ] **3.4** Verify public cannot see details
  - Without viewing key
  - Attempt to decrypt
  - Should fail

---

### 4. Error Scenarios

**Objective:** Verify graceful error handling

#### Network Failures

- [ ] **4.1** Handle RPC disconnect
  - Disconnect internet mid-transaction
  - Verify error message displayed
  - Reconnect and retry works

- [ ] **4.2** Handle wallet disconnect
  - Disconnect wallet during signing
  - Verify error message
  - Reconnect and retry

#### Timeouts

- [ ] **4.3** Intent expiry handling
  - Create intent with short TTL
  - Wait for expiry
  - Verify cannot execute expired intent

- [ ] **4.4** Quote expiry handling
  - Get quote
  - Wait for quote expiry
  - Verify new quote required

#### Invalid Operations

- [ ] **4.5** Insufficient balance
  - Try to swap more than wallet balance
  - Verify error: "Insufficient balance"

- [ ] **4.6** Invalid asset pair
  - Try unsupported asset combination
  - Verify error message

#### Solver Failures

- [ ] **4.7** No quotes available
  - Try very small amount
  - Handle "No quotes available" gracefully

- [ ] **4.8** Solver rejection
  - Solver fails mid-execution
  - Verify refund process
  - Verify funds returned

---

### 5. Multi-Chain Scenarios

**Objective:** Verify all supported chain combinations

| Input | Output | Status |
|-------|--------|--------|
| SOL | ZEC | [ ] |
| SOL | ETH | [ ] |
| SOL | NEAR | [ ] |
| ETH | ZEC | [ ] |
| ETH | SOL | [ ] |
| ETH | NEAR | [ ] |
| NEAR | ZEC | [ ] |
| NEAR | SOL | [ ] |
| NEAR | ETH | [ ] |

---

### 6. Performance Metrics

**Objective:** Verify acceptable performance

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Intent creation | < 500ms | ____ ms | [ ] |
| Quote fetching | < 2s | ____ s | [ ] |
| Swap execution (mock) | < 5s | ____ s | [ ] |
| Swap execution (live) | < 60s | ____ s | [ ] |
| Commitment generation | < 10ms | ____ ms | [ ] |
| Stealth address gen | < 20ms | ____ ms | [ ] |
| Proof generation (mock) | < 100ms | ____ ms | [ ] |

---

## Test Environment Commands

### Run Automated E2E Tests

```bash
# Run all E2E tests
cd packages/sdk
pnpm test -- --grep "E2E"

# Run specific test file
pnpm test -- tests/e2e/cross-chain-swap.test.ts

# Run with verbose output
pnpm test -- --reporter=verbose --grep "E2E"

# Run with coverage
pnpm test -- --coverage --grep "E2E"
```

### Run with Live Testnet (requires env vars)

```bash
# Set environment variables first
export NEAR_INTENTS_JWT="..."

# Run live API tests
pnpm test -- tests/e2e --grep "Live API"
```

### Debug Mode

```bash
# Run single test with debug
DEBUG=sip:* pnpm test -- --grep "should complete SOL → ZEC"
```

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA Engineer | | | |
| Product Manager | | | |

---

## Issues Found

| # | Description | Severity | Status |
|---|-------------|----------|--------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

## Notes

- All tests should pass on testnet before mainnet deployment
- Privacy tests should be verified by independent auditor
- Performance metrics may vary based on network conditions
- Keep viewing keys secure during compliance testing
