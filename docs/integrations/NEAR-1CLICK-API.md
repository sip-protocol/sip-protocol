# NEAR 1Click API Integration

Technical documentation for integrating NEAR Intents 1Click API with SIP Protocol.

## Overview

NEAR Intents is a multichain transaction protocol where users specify desired outcomes and third parties (solvers/market makers) compete to provide optimal solutions. The 1Click API abstracts backend complexity for easy integration.

### Key Characteristics

- **Intent-Based**: Users declare what they want, not how to execute
- **Competitive**: Market makers compete for best prices
- **Cross-Chain**: Supports multiple chains via unified interface
- **Non-Custodial**: Funds flow directly, never held by intermediaries

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User/Agent    │────▶│   1Click API     │────▶│  Solver Network │
│                 │     │ (REST + WS)      │     │ (Market Makers) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │                        ▼                        │
        │               ┌──────────────────┐              │
        │               │   Solver Bus     │◀─────────────┘
        │               │ (Quote Routing)  │
        │               └──────────────────┘
        │                        │
        │                        ▼
        │               ┌──────────────────┐
        └──────────────▶│  Verifier Smart  │
                        │   Contract       │
                        │   (NEAR Chain)   │
                        └──────────────────┘
```

### Component Roles

| Component | Function |
|-----------|----------|
| **1Click API** | REST gateway for distribution channels (apps, wallets) |
| **Solver Bus** | Off-chain message bus routing quotes between users and solvers |
| **Solver/Market Maker** | Competes to fulfill intents optimally |
| **Verifier Contract** | On-chain settlement and verification (NEAR Protocol) |

## 1Click API Reference

### Base URL

```
https://1click.chaindefuser.com/
```

### Authentication

JWT token optional but recommended. Without JWT, 0.1% fee applies (effective August 5, 2025).

Request API key: https://forms.gle/near-intents-api-key

### Endpoints

#### 1. Get Supported Tokens

```http
GET /v0/tokens
```

Returns available tokens with metadata.

**Response**:
```json
[
  {
    "defuse_asset_id": "near:mainnet:wrap.near",
    "blockchain": "near",
    "address": "wrap.near",
    "symbol": "wNEAR",
    "decimals": 24,
    "priceUsd": "3.45"
  }
]
```

#### 2. Request Swap Quote

```http
POST /v0/quote
```

**Request Body**:
```json
{
  "dry": false,
  "swapType": "EXACT_INPUT",
  "slippageTolerance": 100,
  "originAsset": "near:mainnet:wrap.near",
  "destinationAsset": "eth:1:0x0000000000000000000000000000000000000000",
  "amount": "1000000000000000000000000",
  "refundTo": "user.near",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f...",
  "depositType": "near",
  "refundType": "near",
  "recipientType": "eth",
  "deadline": "2024-12-01T00:00:00.000Z",
  "depositMode": "SIMPLE"
}
```

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dry` | boolean | No | Preview only, no deposit address generated |
| `swapType` | enum | Yes | `EXACT_INPUT`, `EXACT_OUTPUT`, `FLEX_INPUT`, `ANY_INPUT` |
| `slippageTolerance` | number | No | Basis points (100 = 1%) |
| `originAsset` | string | Yes | Source asset identifier |
| `destinationAsset` | string | Yes | Target asset identifier |
| `amount` | string | Yes | Amount in smallest units |
| `refundTo` | string | Yes | Address for failed transaction refunds |
| `recipient` | string | Yes | Destination address for output |
| `depositType` | string | Yes | Source chain identifier |
| `refundType` | string | Yes | Refund chain identifier |
| `recipientType` | string | Yes | Destination chain identifier |
| `deadline` | string | No | ISO timestamp for refund trigger |
| `depositMode` | enum | No | `SIMPLE` or `MEMO` |
| `appFees` | array | No | Additional fee recipients |

**Swap Types**:

| Type | Description |
|------|-------------|
| `EXACT_INPUT` | Fixed input amount, variable output |
| `EXACT_OUTPUT` | Fixed output amount, variable input |
| `FLEX_INPUT` | Partial deposits allowed, variable amounts |
| `ANY_INPUT` | Streaming deposits, ongoing swaps |

**Response**:
```json
{
  "quoteId": "quote_abc123",
  "depositAddress": "0x1234...deposit",
  "amountIn": "1000000000000000000000000",
  "amountInFormatted": "1.0",
  "amountOut": "300000000000000000",
  "amountOutFormatted": "0.3",
  "amountOutUsd": "1050.00",
  "deadline": "2024-12-01T00:00:00.000Z",
  "timeEstimate": 120,
  "signature": "0x..."
}
```

#### 3. Submit Deposit Transaction

```http
POST /v0/deposit/submit
```

**Request Body**:
```json
{
  "txHash": "0xabc123...",
  "depositAddress": "0x1234...deposit",
  "nearSenderAccount": "user.near",
  "memo": "optional_memo"
}
```

#### 4. Check Swap Status

```http
GET /v0/status?depositAddress=0x1234...
```

**Response**:
```json
{
  "status": "SUCCESS",
  "depositTxHash": "0xabc...",
  "settlementTxHash": "0xdef...",
  "amountIn": "1000000000000000000000000",
  "amountOut": "300000000000000000"
}
```

**Status Values**:

| Status | Description |
|--------|-------------|
| `PENDING_DEPOSIT` | Awaiting user deposit |
| `PROCESSING` | Deposit detected, execution in progress |
| `SUCCESS` | Delivered to destination |
| `INCOMPLETE_DEPOSIT` | Below minimum threshold |
| `REFUNDED` | Returned automatically |
| `FAILED` | Execution error |

## Solver Relay API

Direct solver integration for advanced use cases.

### Endpoint

```
POST https://solver-relay-v2.chaindefuser.com/rpc
WSS  wss://solver-relay-v2.chaindefuser.com/ws
```

### JSON-RPC Methods

#### 1. Request Quote

```json
{
  "jsonrpc": "2.0",
  "method": "quote",
  "params": {
    "defuse_asset_identifier_in": "near:mainnet:wrap.near",
    "defuse_asset_identifier_out": "eth:1:native",
    "exact_amount_in": "1000000000000000000000000",
    "min_deadline_ms": 60000
  },
  "id": 1
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "quote_hash": "0x...",
    "defuse_asset_identifier_in": "near:mainnet:wrap.near",
    "defuse_asset_identifier_out": "eth:1:native",
    "amount_in": "1000000000000000000000000",
    "amount_out": "300000000000000000",
    "expiration_time": "2024-11-26T12:00:00Z"
  },
  "id": 1
}
```

#### 2. Publish Intent

```json
{
  "jsonrpc": "2.0",
  "method": "publish_intent",
  "params": {
    "quote_hashes": ["0x..."],
    "signed_data": {
      "message": "...",
      "nonce": "123456",
      "recipient": "solver.near"
    },
    "signature_type": "nep413"
  },
  "id": 2
}
```

**Supported Signature Types**:
- `nep413` - NEAR Protocol standard
- `erc191` - Ethereum-compatible
- `raw_ed25519` - Raw Ed25519 signatures

#### 3. Get Status

```json
{
  "jsonrpc": "2.0",
  "method": "get_status",
  "params": {
    "quote_hash": "0x..."
  },
  "id": 3
}
```

**Status Values**:
- `PENDING` - Awaiting execution
- `TX_BROADCASTED` - Transaction submitted
- `SETTLED` - Complete with tx hash
- `NOT_FOUND_OR_NOT_VALID` - Invalid or expired

### WebSocket Events

**Subscribe to Quotes** (for solvers):
```json
{
  "method": "subscribe",
  "params": ["quote"]
}
```

**Quote Event**:
```json
{
  "event": "quote",
  "data": {
    "quote_id": "...",
    "defuse_asset_identifier_in": "...",
    "defuse_asset_identifier_out": "...",
    "exact_amount_in": "...",
    "min_deadline_ms": 60000
  }
}
```

## Intent Flow

### 1. Standard Flow (1Click API)

```
User                    1Click API              Solvers              NEAR Chain
  │                         │                      │                     │
  │── POST /v0/quote ──────▶│                      │                     │
  │                         │── Broadcast ────────▶│                     │
  │                         │◀── Compete & Quote ──│                     │
  │◀── Quote Response ──────│                      │                     │
  │                         │                      │                     │
  │── Deposit to address ──────────────────────────────────────────────▶│
  │                         │                      │                     │
  │                         │◀─ Detect Deposit ────│◀────────────────────│
  │                         │                      │                     │
  │                         │── Execute Intent ───▶│── Call Verifier ───▶│
  │                         │                      │◀── Verify & Settle ─│
  │                         │                      │                     │
  │◀── Status: SUCCESS ─────│◀─ Settlement Confirmed ─────────────────│
```

### 2. Token Diff Intent

Core intent type on verifier contract:

```json
{
  "token_diff": {
    "near:mainnet:wrap.near": "-1000000000000000000000000",
    "eth:1:native": "300000000000000000"
  }
}
```

- **Positive values**: Tokens to receive
- **Negative values**: Tokens to transfer out

## Asset Identifiers

Format: `{chain}:{network}:{address}`

| Asset | Identifier |
|-------|------------|
| NEAR (native) | `near:mainnet:native` |
| wNEAR | `near:mainnet:wrap.near` |
| ETH (native) | `eth:1:native` |
| USDC (Ethereum) | `eth:1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` |
| SOL (native) | `sol:mainnet:native` |
| ZEC (native) | `zcash:mainnet:native` |

## Rate Limits

| Tier | Requests/min | Notes |
|------|--------------|-------|
| Anonymous | 60 | 0.1% fee applies |
| Authenticated | 600 | JWT required |

## Error Handling

### HTTP Errors

| Code | Meaning |
|------|---------|
| 400 | Invalid request parameters |
| 401 | Authentication required/invalid |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

### Quote Errors

| Error | Description |
|-------|-------------|
| `INSUFFICIENT_LIQUIDITY` | No solvers can fill this amount |
| `UNSUPPORTED_PAIR` | Asset pair not supported |
| `AMOUNT_TOO_LOW` | Below minimum threshold (~0.1 NEAR equivalent) |
| `DEADLINE_TOO_SHORT` | Deadline must be at least min_deadline_ms |

## SIP Integration Points

### Privacy Shielding Opportunities

1. **Recipient Shielding**
   - Use stealth addresses as `recipient` parameter
   - One-time addresses prevent linkability

2. **Amount Hiding**
   - Input amounts visible on source chain
   - Output amounts hidden via Zcash shielded pools (when supported)

3. **Viewing Key Disclosure**
   - Generate viewing keys for compliant mode
   - Solvers can verify amounts without full disclosure

### Integration Flow with SIP

```
┌─────────────────────────────────────────────────────────────────┐
│                        SIP Client                                │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐ │
│  │ Stealth Address │──▶│ Intent Builder   │──▶│ 1Click API   │ │
│  │   Generator     │   │ (with privacy)   │   │   Adapter    │ │
│  └─────────────────┘   └──────────────────┘   └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │   NEAR 1Click API    │
                    │   (swap execution)   │
                    └──────────────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │   Destination Chain  │
                    │   (stealth address)  │
                    └──────────────────────┘
```

## References

- [NEAR Intents Overview](https://docs.near.org/chain-abstraction/intents/overview)
- [1Click API Documentation](https://docs.near-intents.org/near-intents/integration/distribution-channels/1click-api)
- [Solver Relay API](https://docs.near-intents.org/near-intents/market-makers/bus/solver-relay)
- [GitHub Example](https://github.com/nearuaguild/near-intents-1click-example)
- [Intents Explorer](https://intents.near.org)
