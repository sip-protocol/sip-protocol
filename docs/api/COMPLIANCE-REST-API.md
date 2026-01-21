# SIP Compliance REST API Specification

**Institutional-Grade API for Privacy Compliance**

**Version:** 1.0.0
**Base URL:** `https://api.sip-protocol.org/v1`
**Status:** Draft

---

## Overview

The SIP Compliance REST API provides institutional clients with programmatic access to viewing key management, transaction visibility, compliance reporting, and audit capabilities. This API is designed for integration with custodians, compliance tools, and enterprise systems.

### Key Features

| Feature | Description |
|---------|-------------|
| **Viewing Key Management** | Register, delegate, and revoke viewing keys |
| **Transaction Visibility** | Decrypt and query shielded transactions |
| **Compliance Reporting** | Generate audit-ready compliance reports |
| **Balance Proofs** | Cryptographic balance attestations |
| **Webhooks** | Real-time transaction notifications |
| **Audit Logging** | Immutable logs of all API access |

---

## Authentication

### API Key Authentication

All API requests require authentication via API key in the `Authorization` header:

```
Authorization: Bearer sip_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### API Key Types

| Type | Prefix | Permissions | Use Case |
|------|--------|-------------|----------|
| Live | `sip_live_` | Full access | Production |
| Test | `sip_test_` | Sandbox only | Development |
| Read-only | `sip_read_` | GET requests only | Monitoring |

### Key Management

```bash
# Create API key via dashboard or CLI
sip keys create --name "Production API" --permissions full

# Rotate key
sip keys rotate sip_live_old_key

# Revoke key
sip keys revoke sip_live_compromised_key
```

### Request Signing (Optional Enhanced Security)

For high-security environments, requests can be signed:

```
X-SIP-Timestamp: 1706123456
X-SIP-Signature: sha256=xxxxxxxxxxxx
```

Signature calculation:
```
signature = HMAC-SHA256(
  api_secret,
  timestamp + "." + method + "." + path + "." + body_hash
)
```

---

## Rate Limiting

### Default Limits

| Tier | Requests/Second | Requests/Day | Burst |
|------|-----------------|--------------|-------|
| Free | 10 | 10,000 | 20 |
| Pro | 100 | 100,000 | 200 |
| Enterprise | 1,000 | Unlimited | 2,000 |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706123500
```

### Rate Limit Response

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Retry after 5 seconds.",
    "retry_after": 5
  }
}
```

---

## API Endpoints

### 1. Viewing Key Management

#### 1.1 Register Viewing Key

Register a viewing key for compliance access.

```
POST /viewing-keys/register
```

**Request:**
```json
{
  "account_id": "acct_abc123",
  "viewing_public_key": "0x02abc...def",
  "delegation_scope": {
    "type": "full",
    "valid_from": "2026-01-01T00:00:00Z",
    "valid_until": "2026-12-31T23:59:59Z"
  },
  "metadata": {
    "purpose": "annual_audit",
    "authorized_by": "compliance_officer"
  }
}
```

**Response:**
```json
{
  "id": "vk_xyz789",
  "account_id": "acct_abc123",
  "key_hash": "0x7a3f9b2c...4d8e1f6a",
  "delegation_scope": {
    "type": "full",
    "valid_from": "2026-01-01T00:00:00Z",
    "valid_until": "2026-12-31T23:59:59Z"
  },
  "status": "active",
  "created_at": "2026-01-15T14:32:05Z"
}
```

#### 1.2 List Viewing Keys

```
GET /viewing-keys?account_id={account_id}&status={status}
```

**Response:**
```json
{
  "data": [
    {
      "id": "vk_xyz789",
      "account_id": "acct_abc123",
      "key_hash": "0x7a3f9b2c...4d8e1f6a",
      "delegation_scope": {
        "type": "full",
        "valid_from": "2026-01-01T00:00:00Z",
        "valid_until": "2026-12-31T23:59:59Z"
      },
      "status": "active",
      "created_at": "2026-01-15T14:32:05Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "per_page": 20
  }
}
```

#### 1.3 Get Viewing Key

```
GET /viewing-keys/{key_id}
```

#### 1.4 Revoke Viewing Key

```
DELETE /viewing-keys/{key_id}
```

**Request:**
```json
{
  "reason": "audit_complete",
  "revoked_by": "compliance_officer"
}
```

**Response:**
```json
{
  "id": "vk_xyz789",
  "status": "revoked",
  "revoked_at": "2026-01-20T10:15:00Z",
  "reason": "audit_complete"
}
```

---

### 2. Transaction Visibility

#### 2.1 Get Transactions

Retrieve decrypted transaction history for an address.

```
GET /transactions/{address}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `viewing_key` | string | Required. Encrypted viewing key |
| `start_date` | datetime | Filter start date |
| `end_date` | datetime | Filter end date |
| `chain` | string | Filter by chain (ethereum, solana, etc.) |
| `direction` | string | `incoming`, `outgoing`, or `all` |
| `min_amount` | string | Minimum amount filter |
| `max_amount` | string | Maximum amount filter |
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Results per page (default: 50, max: 200) |

**Response:**
```json
{
  "data": [
    {
      "tx_hash": "0x1234...abcd",
      "block_number": 19500000,
      "chain": "ethereum",
      "timestamp": "2026-01-15T14:32:05Z",
      "direction": "outgoing",
      "sender": "0xaaaa...1111",
      "recipient": "0xbbbb...2222",
      "stealth_address": "0xcccc...3333",
      "amount": "50000.000000",
      "token": "USDC",
      "token_address": "0xa0b8...6eb48",
      "privacy_level": "compliant",
      "memo": "Invoice #12345",
      "compliance": {
        "sanctions_status": "clear",
        "risk_score": 2.3,
        "screened_at": "2026-01-15T14:32:00Z"
      }
    }
  ],
  "pagination": {
    "total": 1247,
    "page": 1,
    "per_page": 50,
    "total_pages": 25
  },
  "summary": {
    "total_incoming": "1234567.890000",
    "total_outgoing": "987654.320000",
    "transaction_count": 1247
  }
}
```

#### 2.2 Get Transaction Details

```
GET /transactions/{chain}/{tx_hash}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `viewing_key` | string | Required. Encrypted viewing key |

**Response:**
```json
{
  "tx_hash": "0x1234...abcd",
  "block_number": 19500000,
  "block_hash": "0xdef0...5678",
  "chain": "ethereum",
  "timestamp": "2026-01-15T14:32:05Z",
  "confirmations": 150,
  "direction": "outgoing",
  "sender": {
    "address": "0xaaaa...1111",
    "label": "Treasury Wallet"
  },
  "recipient": {
    "address": "0xbbbb...2222",
    "stealth_address": "0xcccc...3333",
    "label": "Vendor Payment"
  },
  "amount": "50000.000000",
  "token": {
    "symbol": "USDC",
    "address": "0xa0b8...6eb48",
    "decimals": 6
  },
  "privacy_level": "compliant",
  "viewing_key_hash": "0x7a3f...1f6a",
  "memo": "Invoice #12345",
  "gas": {
    "used": 150000,
    "price": "25000000000",
    "cost_eth": "0.00375"
  },
  "compliance": {
    "sanctions_status": "clear",
    "risk_score": 2.3,
    "risk_factors": [],
    "screened_at": "2026-01-15T14:32:00Z",
    "travel_rule": {
      "required": true,
      "status": "compliant",
      "originator_vasp": "Anchorage Digital",
      "beneficiary_vasp": "Example Exchange"
    }
  },
  "proof": {
    "commitment": "0x4d8e...7a3f",
    "ephemeral_pubkey": "0x02abc...def",
    "view_tag": 42
  }
}
```

#### 2.3 Search Transactions

```
POST /transactions/search
```

**Request:**
```json
{
  "viewing_key": "encrypted_key_here",
  "query": {
    "accounts": ["acct_abc123", "acct_def456"],
    "chains": ["ethereum", "solana"],
    "date_range": {
      "start": "2026-01-01T00:00:00Z",
      "end": "2026-01-31T23:59:59Z"
    },
    "amount_range": {
      "min": "10000",
      "max": "1000000"
    },
    "counterparties": ["0xbbbb...2222"],
    "risk_score_max": 5,
    "privacy_levels": ["shielded", "compliant"]
  },
  "sort": {
    "field": "timestamp",
    "order": "desc"
  },
  "pagination": {
    "page": 1,
    "per_page": 100
  }
}
```

---

### 3. Compliance Reporting

#### 3.1 Generate Compliance Report

```
POST /reports/compliance
```

**Request:**
```json
{
  "account_id": "acct_abc123",
  "viewing_key": "encrypted_key_here",
  "report_type": "annual_audit",
  "period": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-12-31T23:59:59Z"
  },
  "format": "pdf",
  "options": {
    "include_transaction_proofs": true,
    "include_risk_details": true,
    "include_sanctions_screening": true,
    "digital_signature": true,
    "encrypt_output": false
  },
  "delivery": {
    "method": "webhook",
    "webhook_url": "https://compliance.example.com/reports"
  }
}
```

**Response:**
```json
{
  "report_id": "rpt_12345",
  "status": "processing",
  "estimated_completion": "2026-01-15T15:00:00Z",
  "created_at": "2026-01-15T14:32:05Z"
}
```

#### 3.2 Get Report Status

```
GET /reports/{report_id}
```

**Response:**
```json
{
  "report_id": "rpt_12345",
  "status": "completed",
  "report_type": "annual_audit",
  "period": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-12-31T23:59:59Z"
  },
  "format": "pdf",
  "file_size": 2456789,
  "download_url": "https://reports.sip-protocol.org/rpt_12345.pdf",
  "download_expires_at": "2026-01-16T14:32:05Z",
  "summary": {
    "total_transactions": 1847,
    "total_volume_in": "45678901.23",
    "total_volume_out": "42345678.90",
    "risk_distribution": {
      "low": 1720,
      "medium": 115,
      "high": 12
    }
  },
  "created_at": "2026-01-15T14:32:05Z",
  "completed_at": "2026-01-15T14:45:30Z"
}
```

#### 3.3 List Reports

```
GET /reports?account_id={account_id}&status={status}
```

#### 3.4 Download Report

```
GET /reports/{report_id}/download
```

Returns binary file with appropriate `Content-Type` header.

---

### 4. Balance Proofs

#### 4.1 Get Balance

Get current balance with cryptographic proof.

```
GET /balances/{address}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `viewing_key` | string | Required. Encrypted viewing key |
| `chain` | string | Filter by chain |
| `token` | string | Filter by token symbol |
| `include_proof` | boolean | Include cryptographic proof (default: true) |

**Response:**
```json
{
  "address": "0xaaaa...1111",
  "balances": [
    {
      "chain": "ethereum",
      "token": "USDC",
      "token_address": "0xa0b8...6eb48",
      "balance": "1234567.890000",
      "pending_in": "50000.000000",
      "pending_out": "25000.000000",
      "available": "1259567.890000",
      "last_updated": "2026-01-15T14:32:05Z"
    },
    {
      "chain": "solana",
      "token": "USDC",
      "token_address": "EPjFW...abc",
      "balance": "567890.120000",
      "pending_in": "0.000000",
      "pending_out": "0.000000",
      "available": "567890.120000",
      "last_updated": "2026-01-15T14:32:05Z"
    }
  ],
  "total_usd": "1802458.01",
  "proof": {
    "merkle_root": "0x4d8e...7a3f",
    "block_height": 19500000,
    "timestamp": "2026-01-15T14:32:05Z",
    "signature": "0x304402..."
  }
}
```

#### 4.2 Generate Balance Attestation

Generate a signed attestation of balance at a specific point in time.

```
POST /balances/{address}/attestation
```

**Request:**
```json
{
  "viewing_key": "encrypted_key_here",
  "attestation_date": "2025-12-31T23:59:59Z",
  "chains": ["ethereum", "solana"],
  "tokens": ["USDC", "ETH", "SOL"],
  "format": "pdf"
}
```

**Response:**
```json
{
  "attestation_id": "att_67890",
  "address": "0xaaaa...1111",
  "attestation_date": "2025-12-31T23:59:59Z",
  "balances": [
    {
      "chain": "ethereum",
      "token": "USDC",
      "balance": "1000000.000000"
    }
  ],
  "total_usd": "1500000.00",
  "proof": {
    "merkle_root": "0x4d8e...7a3f",
    "block_heights": {
      "ethereum": 19400000,
      "solana": 250000000
    },
    "signature": "0x304402..."
  },
  "download_url": "https://attestations.sip-protocol.org/att_67890.pdf"
}
```

---

### 5. Viewing Key Delegation

#### 5.1 Delegate Viewing Key

Delegate viewing key access to another party with time-bound permissions.

```
POST /viewing-keys/delegate
```

**Request:**
```json
{
  "source_key_id": "vk_xyz789",
  "delegate_public_key": "0x03def...abc",
  "delegation": {
    "type": "time_bounded",
    "permissions": ["read_transactions", "generate_reports"],
    "valid_from": "2026-01-15T00:00:00Z",
    "valid_until": "2026-02-15T23:59:59Z",
    "chains": ["ethereum", "solana"],
    "max_transactions": 10000
  },
  "metadata": {
    "delegate_name": "External Auditor",
    "purpose": "Q4 2025 Audit",
    "contact": "auditor@example.com"
  }
}
```

**Response:**
```json
{
  "delegation_id": "del_abc123",
  "source_key_id": "vk_xyz789",
  "delegate_key_hash": "0x9b2c...4d8e",
  "encrypted_delegation_key": "0x...(encrypted to delegate's public key)",
  "delegation": {
    "type": "time_bounded",
    "permissions": ["read_transactions", "generate_reports"],
    "valid_from": "2026-01-15T00:00:00Z",
    "valid_until": "2026-02-15T23:59:59Z"
  },
  "status": "active",
  "created_at": "2026-01-15T14:32:05Z"
}
```

#### 5.2 List Delegations

```
GET /viewing-keys/{key_id}/delegations
```

#### 5.3 Revoke Delegation

```
DELETE /viewing-keys/delegations/{delegation_id}
```

---

### 6. Webhooks

#### 6.1 Create Webhook

```
POST /webhooks
```

**Request:**
```json
{
  "url": "https://compliance.example.com/webhooks/sip",
  "events": [
    "transaction.received",
    "transaction.sent",
    "viewing_key.delegated",
    "viewing_key.revoked",
    "report.completed",
    "alert.triggered"
  ],
  "account_ids": ["acct_abc123"],
  "secret": "whsec_xxxxxxxxxxxxxxxx"
}
```

**Response:**
```json
{
  "id": "wh_12345",
  "url": "https://compliance.example.com/webhooks/sip",
  "events": ["transaction.received", "transaction.sent"],
  "status": "active",
  "created_at": "2026-01-15T14:32:05Z"
}
```

#### 6.2 Webhook Payload

```json
{
  "id": "evt_67890",
  "type": "transaction.received",
  "created_at": "2026-01-15T14:32:05Z",
  "data": {
    "tx_hash": "0x1234...abcd",
    "chain": "ethereum",
    "account_id": "acct_abc123",
    "amount": "50000.000000",
    "token": "USDC",
    "compliance": {
      "sanctions_status": "clear",
      "risk_score": 2.3
    }
  }
}
```

#### 6.3 Webhook Signature Verification

```
X-SIP-Signature: sha256=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
X-SIP-Timestamp: 1706123456
```

Verification:
```javascript
const crypto = require('crypto')

function verifyWebhook(payload, signature, timestamp, secret) {
  const signedPayload = `${timestamp}.${payload}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')

  return `sha256=${expectedSignature}` === signature
}
```

#### 6.4 List Webhooks

```
GET /webhooks
```

#### 6.5 Update Webhook

```
PATCH /webhooks/{webhook_id}
```

#### 6.6 Delete Webhook

```
DELETE /webhooks/{webhook_id}
```

#### 6.7 Test Webhook

```
POST /webhooks/{webhook_id}/test
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_VIEWING_KEY",
    "message": "The provided viewing key is invalid or expired",
    "details": {
      "key_hash": "0x7a3f...1f6a",
      "expired_at": "2025-12-31T23:59:59Z"
    },
    "request_id": "req_abc123"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_REQUEST` | 400 | Malformed request |
| `INVALID_VIEWING_KEY` | 400 | Viewing key invalid or expired |
| `DELEGATION_EXPIRED` | 400 | Delegation has expired |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## Audit Logging

All API calls are logged immutably for compliance purposes.

### Audit Log Entry

```json
{
  "log_id": "log_abc123",
  "timestamp": "2026-01-15T14:32:05Z",
  "api_key_id": "key_xyz789",
  "method": "GET",
  "path": "/v1/transactions/0xaaaa...1111",
  "query_params": {
    "viewing_key": "[REDACTED]",
    "start_date": "2025-01-01T00:00:00Z"
  },
  "response_status": 200,
  "response_time_ms": 145,
  "ip_address": "192.168.1.100",
  "user_agent": "SIP-SDK/1.0.0",
  "request_id": "req_abc123"
}
```

### Get Audit Logs

```
GET /audit-logs?start_date={start}&end_date={end}&api_key_id={key_id}
```

---

## SDK Examples

### TypeScript/JavaScript

```typescript
import { SIPComplianceAPI } from '@sip-protocol/compliance-sdk'

const api = new SIPComplianceAPI({
  apiKey: process.env.SIP_API_KEY,
  baseUrl: 'https://api.sip-protocol.org/v1'
})

// Register viewing key
const registration = await api.viewingKeys.register({
  accountId: 'acct_abc123',
  viewingPublicKey: '0x02abc...def',
  delegationScope: { type: 'full' }
})

// Get transactions
const transactions = await api.transactions.list({
  address: '0xaaaa...1111',
  viewingKey: encryptedViewingKey,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-12-31')
})

// Generate compliance report
const report = await api.reports.create({
  accountId: 'acct_abc123',
  viewingKey: encryptedViewingKey,
  reportType: 'annual_audit',
  period: {
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31')
  },
  format: 'pdf'
})

// Wait for report completion
const completedReport = await api.reports.waitForCompletion(report.reportId)

// Download report
const pdfBuffer = await api.reports.download(completedReport.reportId)
```

### Python

```python
from sip_protocol import ComplianceAPI

api = ComplianceAPI(api_key=os.environ['SIP_API_KEY'])

# Register viewing key
registration = api.viewing_keys.register(
    account_id='acct_abc123',
    viewing_public_key='0x02abc...def',
    delegation_scope={'type': 'full'}
)

# Get transactions
transactions = api.transactions.list(
    address='0xaaaa...1111',
    viewing_key=encrypted_viewing_key,
    start_date=datetime(2025, 1, 1),
    end_date=datetime(2025, 12, 31)
)

# Generate compliance report
report = api.reports.create(
    account_id='acct_abc123',
    viewing_key=encrypted_viewing_key,
    report_type='annual_audit',
    period={
        'start': datetime(2025, 1, 1),
        'end': datetime(2025, 12, 31)
    },
    format='pdf'
)

# Download when ready
pdf_bytes = api.reports.download(report.report_id, wait=True)
```

### cURL Examples

```bash
# Register viewing key
curl -X POST https://api.sip-protocol.org/v1/viewing-keys/register \
  -H "Authorization: Bearer sip_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "acct_abc123",
    "viewing_public_key": "0x02abc...def",
    "delegation_scope": {"type": "full"}
  }'

# Get transactions
curl -X GET "https://api.sip-protocol.org/v1/transactions/0xaaaa...1111?viewing_key=xxx&start_date=2025-01-01" \
  -H "Authorization: Bearer sip_live_xxx"

# Generate report
curl -X POST https://api.sip-protocol.org/v1/reports/compliance \
  -H "Authorization: Bearer sip_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "acct_abc123",
    "viewing_key": "xxx",
    "report_type": "annual_audit",
    "period": {"start": "2025-01-01", "end": "2025-12-31"},
    "format": "pdf"
  }'
```

---

## OpenAPI Specification

Full OpenAPI 3.0 specification available at:
- **YAML:** https://api.sip-protocol.org/openapi.yaml
- **JSON:** https://api.sip-protocol.org/openapi.json
- **Swagger UI:** https://api.sip-protocol.org/docs

### OpenAPI Snippet

```yaml
openapi: 3.0.3
info:
  title: SIP Compliance API
  version: 1.0.0
  description: Institutional-grade API for privacy compliance

servers:
  - url: https://api.sip-protocol.org/v1
    description: Production
  - url: https://sandbox.api.sip-protocol.org/v1
    description: Sandbox

security:
  - bearerAuth: []

paths:
  /viewing-keys/register:
    post:
      summary: Register a viewing key
      operationId: registerViewingKey
      tags: [Viewing Keys]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterViewingKeyRequest'
      responses:
        '200':
          description: Viewing key registered
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ViewingKey'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer

  schemas:
    ViewingKey:
      type: object
      properties:
        id:
          type: string
          example: vk_xyz789
        account_id:
          type: string
          example: acct_abc123
        key_hash:
          type: string
          example: "0x7a3f9b2c...4d8e1f6a"
        status:
          type: string
          enum: [active, revoked, expired]
        created_at:
          type: string
          format: date-time
```

---

## Changelog

### v1.0.0 (2026-01-21)

- Initial release
- Viewing key management endpoints
- Transaction visibility API
- Compliance reporting
- Balance proofs
- Webhook support
- SDK for TypeScript and Python

---

**API Support:** api-support@sip-protocol.org
**Status Page:** https://status.sip-protocol.org
**Documentation:** https://docs.sip-protocol.org/api
