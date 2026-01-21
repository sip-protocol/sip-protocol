# Agent Viewing Key Delegation API Specification

**Version:** 1.0.0
**Status:** Draft
**Created:** January 2026
**Authors:** SIP Protocol Team

---

## Abstract

This specification defines an API for creating and managing viewing key delegations specifically designed for AI agents. As AI agents increasingly manage DAO treasuries, enterprise payments, and automated financial operations, they require privacy for competitive reasons while maintaining compliance for regulatory audits. This API enables secure, scoped, revocable viewing access for autonomous agents.

---

## Table of Contents

1. [Motivation](#motivation)
2. [Know Your Agent Framework](#know-your-agent-framework)
3. [Core API](#core-api)
4. [Agent Credentials](#agent-credentials)
5. [Permission Model](#permission-model)
6. [Delegation Flow](#delegation-flow)
7. [Revocation](#revocation)
8. [Audit Trail](#audit-trail)
9. [Multi-Agent Scenarios](#multi-agent-scenarios)
10. [Security Considerations](#security-considerations)
11. [SDK Integration](#sdk-integration)
12. [Reference Implementation](#reference-implementation)

---

## 1. Motivation

### The Rise of Autonomous Agents

AI agents are increasingly managing financial operations:

- **DAO Treasuries**: Automated rebalancing, yield optimization, payment execution
- **Enterprise Payments**: Invoice processing, payroll, vendor payments
- **Trading Bots**: Market making, arbitrage, portfolio management
- **Compliance Automation**: Report generation, audit preparation

### The Challenge

Agents need viewing access for operations, but traditional approaches have problems:

| Approach | Problem |
|----------|---------|
| Full key access | Agent can steal funds |
| No access | Agent cannot operate |
| Manual approval | Defeats automation purpose |
| API keys | No cryptographic verification |

### The Solution

Agent Viewing Keys provide:

- **Cryptographic Credentials**: Verifiable agent identity
- **Scoped Access**: View-only, no spending authority
- **Time-Bound**: Automatic expiration
- **Revocable**: Instant access termination
- **Auditable**: Complete access trail

---

## 2. Know Your Agent Framework

> "Know your agent: agents will need cryptographically signed credentials to transact."
> — a16z Big Ideas 2026

### Agent Identity Model

```typescript
/**
 * Agent identity structure
 * Inspired by a16z "Know Your Agent" framework
 */
interface AgentIdentity {
  /**
   * Unique agent identifier
   * Format: agent_<provider>_<random_id>
   * Example: agent_anthropic_abc123def456
   */
  agentId: AgentId;

  /**
   * Agent provider/operator
   * The organization responsible for the agent
   */
  provider: AgentProvider;

  /**
   * Agent type classification
   */
  type: AgentType;

  /**
   * Agent capabilities (what it can do)
   */
  capabilities: AgentCapability[];

  /**
   * Cryptographic public key for agent
   * Used for signature verification
   */
  publicKey: PublicKey;

  /**
   * Agent metadata
   */
  metadata: AgentMetadata;

  /**
   * Registration timestamp
   */
  registeredAt: Timestamp;

  /**
   * Attestation from provider (optional)
   */
  attestation?: ProviderAttestation;
}

/**
 * Agent ID format
 */
type AgentId = `agent_${string}_${string}`;

/**
 * Known agent providers
 */
enum AgentProvider {
  // AI Providers
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  GOOGLE = 'google',
  COHERE = 'cohere',

  // Agent Frameworks
  LANGCHAIN = 'langchain',
  AUTOGPT = 'autogpt',
  CREW_AI = 'crewai',

  // Crypto-Native
  GOAT = 'goat',           // GOAT SDK
  ELIZA = 'eliza',         // ai16z Eliza
  BRIAN = 'brian',         // Brian AI
  WAYFINDER = 'wayfinder', // Wayfinder AI

  // Enterprise
  SALESFORCE = 'salesforce',
  MICROSOFT = 'microsoft',

  // Custom/Self-hosted
  CUSTOM = 'custom',
  SELF_HOSTED = 'self_hosted'
}

/**
 * Agent type classifications
 */
enum AgentType {
  // Treasury & Finance
  TREASURY_MANAGER = 'treasury_manager',
  PAYMENT_PROCESSOR = 'payment_processor',
  YIELD_OPTIMIZER = 'yield_optimizer',
  REBALANCER = 'rebalancer',

  // Trading
  MARKET_MAKER = 'market_maker',
  ARBITRAGE_BOT = 'arbitrage_bot',
  PORTFOLIO_MANAGER = 'portfolio_manager',

  // Compliance
  AUDITOR = 'auditor',
  REPORT_GENERATOR = 'report_generator',
  SANCTIONS_SCREENER = 'sanctions_screener',

  // Operations
  INVOICE_PROCESSOR = 'invoice_processor',
  PAYROLL_AGENT = 'payroll_agent',

  // General
  GENERAL_PURPOSE = 'general_purpose',
  CUSTOM = 'custom'
}

/**
 * Agent capabilities
 */
enum AgentCapability {
  // Viewing
  VIEW_BALANCE = 'view_balance',
  VIEW_TRANSACTIONS = 'view_transactions',
  VIEW_PENDING = 'view_pending',

  // Reporting
  GENERATE_REPORTS = 'generate_reports',
  EXPORT_DATA = 'export_data',

  // Analysis
  ANALYZE_PATTERNS = 'analyze_patterns',
  DETECT_ANOMALIES = 'detect_anomalies',

  // Proofs
  PROVE_BALANCE = 'prove_balance',
  PROVE_SOLVENCY = 'prove_solvency',

  // Integration
  WEBHOOK_NOTIFICATIONS = 'webhook_notifications',
  API_CALLBACKS = 'api_callbacks'
}
```

### Provider Attestation

```typescript
/**
 * Attestation from agent provider
 * Proves agent is authorized by a known provider
 */
interface ProviderAttestation {
  /**
   * Provider identifier
   */
  provider: AgentProvider;

  /**
   * Provider's signature over agent identity
   */
  signature: Signature;

  /**
   * Provider's public key for verification
   */
  providerPublicKey: PublicKey;

  /**
   * Attestation timestamp
   */
  attestedAt: Timestamp;

  /**
   * Attestation expiry (optional)
   */
  expiresAt?: Timestamp;

  /**
   * Provider-specific claims
   */
  claims?: Record<string, unknown>;
}

/**
 * Registry of known provider public keys
 * Used to verify attestations
 */
const KNOWN_PROVIDER_KEYS: Record<AgentProvider, PublicKey[]> = {
  [AgentProvider.ANTHROPIC]: [
    '0x04abc...', // Production key
    '0x04def...'  // Backup key
  ],
  [AgentProvider.OPENAI]: [
    '0x04123...'
  ],
  // ... other providers
};
```

---

## 3. Core API

### 3.1 Create Agent Viewing Key

```typescript
/**
 * Create a viewing key delegated to an AI agent
 */
interface CreateAgentViewingKeyParams {
  /**
   * Agent identity (required)
   */
  agent: AgentIdentity;

  /**
   * Permissions granted to agent
   */
  permissions: AgentPermission[];

  /**
   * Scope limitations
   */
  scope: AgentScope;

  /**
   * Expiration time (required for agents)
   */
  expiry: Date;

  /**
   * Whether key can be revoked before expiry
   * Default: true
   */
  revocable?: boolean;

  /**
   * Notification webhook for events
   */
  notificationWebhook?: string;

  /**
   * Maximum API calls per hour (rate limiting)
   */
  rateLimit?: number;

  /**
   * Require agent signature for each request
   */
  requireSignature?: boolean;
}

/**
 * Agent viewing key result
 */
interface AgentViewingKey {
  /**
   * Unique key identifier
   */
  keyId: AgentKeyId;

  /**
   * Agent this key is delegated to
   */
  agentId: AgentId;

  /**
   * The encrypted viewing key for agent
   */
  encryptedViewingKey: EncryptedKey;

  /**
   * Permissions granted
   */
  permissions: AgentPermission[];

  /**
   * Scope limitations
   */
  scope: AgentScope;

  /**
   * Creation timestamp
   */
  createdAt: Timestamp;

  /**
   * Expiration timestamp
   */
  expiresAt: Timestamp;

  /**
   * Current status
   */
  status: AgentKeyStatus;

  /**
   * Owner signature authorizing delegation
   */
  ownerSignature: Signature;

  /**
   * Verification data for auditors
   */
  verification: VerificationData;
}

type AgentKeyId = `agentkey_${string}`;

enum AgentKeyStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  SUSPENDED = 'suspended'
}
```

### 3.2 Main API Methods

```typescript
/**
 * Agent Viewing Key API
 */
interface AgentViewingKeyAPI {
  /**
   * Create a new agent viewing key
   */
  createAgentViewingKey(
    params: CreateAgentViewingKeyParams
  ): Promise<AgentViewingKey>;

  /**
   * Get agent viewing key by ID
   */
  getAgentViewingKey(keyId: AgentKeyId): Promise<AgentViewingKey | null>;

  /**
   * List all agent viewing keys for owner
   */
  listAgentViewingKeys(
    options?: ListAgentKeysOptions
  ): Promise<AgentViewingKey[]>;

  /**
   * Revoke an agent viewing key
   */
  revokeAgentViewingKey(
    keyId: AgentKeyId,
    reason: string
  ): Promise<RevocationResult>;

  /**
   * Suspend an agent viewing key temporarily
   */
  suspendAgentViewingKey(
    keyId: AgentKeyId,
    reason: string,
    until?: Date
  ): Promise<SuspensionResult>;

  /**
   * Resume a suspended agent viewing key
   */
  resumeAgentViewingKey(keyId: AgentKeyId): Promise<void>;

  /**
   * Rotate agent viewing key (issue new, revoke old)
   */
  rotateAgentViewingKey(
    keyId: AgentKeyId
  ): Promise<{ newKey: AgentViewingKey; revokedKey: AgentViewingKey }>;

  /**
   * Verify agent viewing key is valid
   */
  verifyAgentViewingKey(
    keyId: AgentKeyId,
    agentSignature?: Signature
  ): Promise<VerificationResult>;

  /**
   * Get usage statistics for agent key
   */
  getAgentKeyUsage(keyId: AgentKeyId): Promise<AgentKeyUsage>;

  /**
   * Get audit log for agent key
   */
  getAgentKeyAuditLog(
    keyId: AgentKeyId,
    options?: AuditLogOptions
  ): Promise<AuditLogEntry[]>;
}
```

---

## 4. Agent Credentials

### 4.1 Credential Structure

```typescript
/**
 * Agent credential for authenticated requests
 */
interface AgentCredential {
  /**
   * Agent viewing key ID
   */
  keyId: AgentKeyId;

  /**
   * Agent identity
   */
  agentId: AgentId;

  /**
   * Request-specific nonce (prevents replay)
   */
  nonce: string;

  /**
   * Timestamp of request
   */
  timestamp: Timestamp;

  /**
   * Request payload hash
   */
  payloadHash: HexString;

  /**
   * Agent's signature over credential
   */
  signature: Signature;
}

/**
 * Create agent credential for a request
 */
function createAgentCredential(
  agentKey: AgentKeyPair,
  keyId: AgentKeyId,
  payload: unknown
): AgentCredential {
  const nonce = generateNonce();
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadHash = sha256(JSON.stringify(payload));

  const message = createCredentialMessage({
    keyId,
    agentId: agentKey.agentId,
    nonce,
    timestamp,
    payloadHash
  });

  const signature = sign(message, agentKey.privateKey);

  return {
    keyId,
    agentId: agentKey.agentId,
    nonce,
    timestamp,
    payloadHash: bytesToHex(payloadHash),
    signature
  };
}
```

### 4.2 Credential Verification

```typescript
/**
 * Verify agent credential
 */
async function verifyAgentCredential(
  credential: AgentCredential,
  expectedPayload: unknown
): Promise<CredentialVerificationResult> {
  // 1. Check timestamp freshness (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - credential.timestamp) > 300) {
    return {
      valid: false,
      reason: 'Credential timestamp too old or in future'
    };
  }

  // 2. Verify payload hash
  const expectedHash = bytesToHex(sha256(JSON.stringify(expectedPayload)));
  if (credential.payloadHash !== expectedHash) {
    return {
      valid: false,
      reason: 'Payload hash mismatch'
    };
  }

  // 3. Check nonce not reused
  const nonceUsed = await checkNonceUsed(credential.nonce);
  if (nonceUsed) {
    return {
      valid: false,
      reason: 'Nonce already used (replay attack)'
    };
  }

  // 4. Get agent viewing key
  const agentKey = await getAgentViewingKey(credential.keyId);
  if (!agentKey) {
    return {
      valid: false,
      reason: 'Agent viewing key not found'
    };
  }

  // 5. Check key status
  if (agentKey.status !== AgentKeyStatus.ACTIVE) {
    return {
      valid: false,
      reason: `Agent key status: ${agentKey.status}`
    };
  }

  // 6. Check expiry
  if (agentKey.expiresAt < now) {
    return {
      valid: false,
      reason: 'Agent viewing key expired'
    };
  }

  // 7. Verify agent signature
  const agent = await getAgentIdentity(credential.agentId);
  if (!agent) {
    return {
      valid: false,
      reason: 'Agent identity not found'
    };
  }

  const message = createCredentialMessage(credential);
  const signatureValid = verify(
    credential.signature,
    message,
    agent.publicKey
  );

  if (!signatureValid) {
    return {
      valid: false,
      reason: 'Invalid agent signature'
    };
  }

  // 8. Mark nonce as used
  await markNonceUsed(credential.nonce, credential.timestamp);

  return {
    valid: true,
    agent,
    agentKey,
    permissions: agentKey.permissions,
    scope: agentKey.scope
  };
}
```

---

## 5. Permission Model

### 5.1 Agent Permissions

```typescript
/**
 * Permissions available to agents
 * More restrictive than general delegations
 */
enum AgentPermission {
  // Balance Operations
  VIEW_BALANCE = 'view_balance',
  VIEW_BALANCE_HISTORY = 'view_balance_history',
  PROVE_MINIMUM_BALANCE = 'prove_minimum_balance',

  // Transaction Operations
  VIEW_TRANSACTIONS = 'view_transactions',
  VIEW_PENDING_TRANSACTIONS = 'view_pending_transactions',
  SEARCH_TRANSACTIONS = 'search_transactions',

  // Reporting
  GENERATE_BALANCE_REPORT = 'generate_balance_report',
  GENERATE_TRANSACTION_REPORT = 'generate_transaction_report',
  GENERATE_COMPLIANCE_REPORT = 'generate_compliance_report',
  EXPORT_CSV = 'export_csv',
  EXPORT_PDF = 'export_pdf',

  // Analysis
  ANALYZE_SPENDING_PATTERNS = 'analyze_spending_patterns',
  DETECT_ANOMALIES = 'detect_anomalies',
  CATEGORIZE_TRANSACTIONS = 'categorize_transactions',

  // Proofs
  GENERATE_SOLVENCY_PROOF = 'generate_solvency_proof',
  GENERATE_TRANSACTION_PROOF = 'generate_transaction_proof',

  // Notifications
  SUBSCRIBE_BALANCE_CHANGES = 'subscribe_balance_changes',
  SUBSCRIBE_TRANSACTIONS = 'subscribe_transactions',

  // Metadata
  VIEW_LABELS = 'view_labels',
  VIEW_CATEGORIES = 'view_categories'
}

/**
 * Permission sets for common agent types
 */
const AGENT_PERMISSION_SETS: Record<AgentType, AgentPermission[]> = {
  [AgentType.TREASURY_MANAGER]: [
    AgentPermission.VIEW_BALANCE,
    AgentPermission.VIEW_BALANCE_HISTORY,
    AgentPermission.VIEW_TRANSACTIONS,
    AgentPermission.VIEW_PENDING_TRANSACTIONS,
    AgentPermission.ANALYZE_SPENDING_PATTERNS,
    AgentPermission.SUBSCRIBE_BALANCE_CHANGES,
    AgentPermission.SUBSCRIBE_TRANSACTIONS
  ],

  [AgentType.AUDITOR]: [
    AgentPermission.VIEW_BALANCE,
    AgentPermission.VIEW_TRANSACTIONS,
    AgentPermission.SEARCH_TRANSACTIONS,
    AgentPermission.GENERATE_COMPLIANCE_REPORT,
    AgentPermission.EXPORT_CSV,
    AgentPermission.EXPORT_PDF,
    AgentPermission.GENERATE_SOLVENCY_PROOF,
    AgentPermission.VIEW_LABELS,
    AgentPermission.VIEW_CATEGORIES
  ],

  [AgentType.REPORT_GENERATOR]: [
    AgentPermission.VIEW_BALANCE,
    AgentPermission.VIEW_TRANSACTIONS,
    AgentPermission.GENERATE_BALANCE_REPORT,
    AgentPermission.GENERATE_TRANSACTION_REPORT,
    AgentPermission.EXPORT_CSV,
    AgentPermission.EXPORT_PDF
  ],

  [AgentType.PORTFOLIO_MANAGER]: [
    AgentPermission.VIEW_BALANCE,
    AgentPermission.VIEW_BALANCE_HISTORY,
    AgentPermission.VIEW_TRANSACTIONS,
    AgentPermission.ANALYZE_SPENDING_PATTERNS,
    AgentPermission.PROVE_MINIMUM_BALANCE,
    AgentPermission.SUBSCRIBE_BALANCE_CHANGES
  ],

  [AgentType.SANCTIONS_SCREENER]: [
    AgentPermission.VIEW_TRANSACTIONS,
    AgentPermission.SEARCH_TRANSACTIONS,
    AgentPermission.DETECT_ANOMALIES
  ]
};
```

### 5.2 Agent Scope

```typescript
/**
 * Scope limitations for agent access
 */
interface AgentScope {
  /**
   * Assets agent can view
   * Empty = all assets
   */
  assets?: string[];

  /**
   * Minimum amount visible (hide small transactions)
   */
  minAmount?: bigint;

  /**
   * Maximum amount visible (hide large transactions)
   */
  maxAmount?: bigint;

  /**
   * Date range for historical access
   */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /**
   * Address allowlist (only these counterparties visible)
   */
  addressAllowlist?: Address[];

  /**
   * Address blocklist (hide these counterparties)
   */
  addressBlocklist?: Address[];

  /**
   * Transaction types visible
   */
  transactionTypes?: TransactionType[];

  /**
   * Chains this key is valid for
   */
  chains?: ChainId[];

  /**
   * Maximum transactions per query
   */
  maxResultsPerQuery?: number;

  /**
   * Rate limit (requests per hour)
   */
  rateLimit?: number;
}
```

---

## 6. Delegation Flow

### 6.1 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AGENT VIEWING KEY DELEGATION FLOW                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Treasury   │         │    Agent     │         │   Auditor    │
│    Owner     │         │  (AI Bot)    │         │              │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │ 1. Register Agent      │                        │
       │ ─────────────────────► │                        │
       │   • Agent generates    │                        │
       │     keypair            │                        │
       │   • Owner verifies     │                        │
       │     identity           │                        │
       │                        │                        │
       │ 2. Create Agent Key    │                        │
       │ ─────────────────────► │                        │
       │   • Permissions set    │                        │
       │   • Scope defined      │                        │
       │   • Expiry configured  │                        │
       │                        │                        │
       │                        │ 3. Agent Operates      │
       │                        │ ◄───────────────────── │
       │                        │   • View balances      │
       │                        │   • Query transactions │
       │                        │   • Generate reports   │
       │                        │                        │
       │                        │ 4. Provide Audit       │
       │                        │ ─────────────────────► │
       │                        │   • Signed reports     │
       │                        │   • Verifiable proofs  │
       │                        │                        │
       │ 5. Verify Reports      │                        │
       │ ◄─────────────────────────────────────────────┤ │
       │   • Verify agent key   │                        │
       │   • Verify signatures  │                        │
       │   • Validate scope     │                        │
       │                        │                        │
       │ 6. Revoke (optional)   │                        │
       │ ─────────────────────► │                        │
       │   • Immediate effect   │                        │
       │   • Auditor notified   │                        │
       │                        │                        │
       ▼                        ▼                        ▼
```

### 6.2 Step-by-Step Implementation

```typescript
/**
 * Step 1: Register agent identity
 */
async function registerAgent(
  agentParams: RegisterAgentParams
): Promise<AgentIdentity> {
  // Generate agent keypair (agent-side)
  const agentKeyPair = generateKeyPair();

  // Create agent identity
  const agentId = generateAgentId(agentParams.provider);
  const agent: AgentIdentity = {
    agentId,
    provider: agentParams.provider,
    type: agentParams.type,
    capabilities: agentParams.capabilities,
    publicKey: agentKeyPair.publicKey,
    metadata: agentParams.metadata,
    registeredAt: Math.floor(Date.now() / 1000)
  };

  // Get provider attestation (optional but recommended)
  if (agentParams.attestFromProvider) {
    agent.attestation = await requestProviderAttestation(agent);
  }

  // Store agent identity
  await storeAgentIdentity(agent);

  return agent;
}

/**
 * Step 2: Treasury owner creates agent viewing key
 */
async function ownerCreatesAgentKey(
  owner: ViewingKeyPair,
  agent: AgentIdentity,
  params: CreateAgentViewingKeyParams
): Promise<AgentViewingKey> {
  // Validate agent identity
  if (agent.attestation) {
    await verifyProviderAttestation(agent.attestation);
  }

  // Validate permissions are appropriate for agent type
  validateAgentPermissions(agent.type, params.permissions);

  // Derive scoped viewing key
  const scopedKey = deriveScopedViewingKey(
    owner,
    agentScopeToScope(params.scope),
    agent.agentId
  );

  // Encrypt key for agent
  const encryptedKey = await encryptForRecipient(
    scopedKey.privateKey,
    agent.publicKey
  );

  // Create agent viewing key
  const agentKey: AgentViewingKey = {
    keyId: generateAgentKeyId(),
    agentId: agent.agentId,
    encryptedViewingKey: encryptedKey,
    permissions: params.permissions,
    scope: params.scope,
    createdAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(params.expiry.getTime() / 1000),
    status: AgentKeyStatus.ACTIVE,
    ownerSignature: signAgentKey(owner, agentKey),
    verification: createVerificationData(owner, agent, agentKey)
  };

  // Store agent key
  await storeAgentViewingKey(agentKey);

  // Notify agent
  if (params.notificationWebhook) {
    await notifyAgent(params.notificationWebhook, {
      event: 'key_created',
      keyId: agentKey.keyId
    });
  }

  return agentKey;
}

/**
 * Step 3: Agent uses viewing key
 */
async function agentOperates(
  agentKeyPair: KeyPair,
  agentKey: AgentViewingKey
): Promise<void> {
  // Decrypt viewing key
  const viewingKey = await decryptViewingKey(
    agentKey.encryptedViewingKey,
    agentKeyPair.privateKey
  );

  // Create SIP client with viewing key
  const sip = new SIP({
    viewingKey,
    scope: agentKey.scope
  });

  // View balance (if permitted)
  if (hasPermission(agentKey, AgentPermission.VIEW_BALANCE)) {
    const balance = await sip.getShieldedBalance();
    console.log('Balance:', balance);
  }

  // Get transactions (if permitted)
  if (hasPermission(agentKey, AgentPermission.VIEW_TRANSACTIONS)) {
    const transactions = await sip.getTransactionHistory({
      limit: agentKey.scope.maxResultsPerQuery || 100
    });
    console.log('Transactions:', transactions.length);
  }

  // Generate report (if permitted)
  if (hasPermission(agentKey, AgentPermission.GENERATE_COMPLIANCE_REPORT)) {
    const report = await sip.generateComplianceReport({
      period: 'Q1-2026',
      format: 'pdf',
      signWithAgentKey: agentKeyPair
    });
    console.log('Report generated:', report.id);
  }
}

/**
 * Step 4: Agent provides signed report to auditor
 */
async function agentProvidesAudit(
  agentKeyPair: KeyPair,
  agentKey: AgentViewingKey,
  auditorRequest: AuditorRequest
): Promise<SignedAuditReport> {
  // Generate report based on request
  const sip = new SIP({
    viewingKey: await decryptViewingKey(
      agentKey.encryptedViewingKey,
      agentKeyPair.privateKey
    )
  });

  const reportData = await sip.generateComplianceReport({
    period: auditorRequest.period,
    format: auditorRequest.format
  });

  // Sign report with agent key
  const signature = sign(
    sha256(reportData.content),
    agentKeyPair.privateKey
  );

  return {
    report: reportData,
    agentId: agentKey.agentId,
    agentKeyId: agentKey.keyId,
    signature,
    generatedAt: Math.floor(Date.now() / 1000),
    scope: agentKey.scope,
    permissions: agentKey.permissions
  };
}

/**
 * Step 5: Auditor verifies report
 */
async function auditorVerifiesReport(
  signedReport: SignedAuditReport
): Promise<AuditVerificationResult> {
  // 1. Get agent identity
  const agent = await getAgentIdentity(signedReport.agentId);
  if (!agent) {
    return { valid: false, reason: 'Agent not found' };
  }

  // 2. Verify agent key is valid
  const agentKey = await getAgentViewingKey(signedReport.agentKeyId);
  if (!agentKey || agentKey.status !== AgentKeyStatus.ACTIVE) {
    return { valid: false, reason: 'Agent key not valid' };
  }

  // 3. Verify report signature
  const signatureValid = verify(
    signedReport.signature,
    sha256(signedReport.report.content),
    agent.publicKey
  );
  if (!signatureValid) {
    return { valid: false, reason: 'Invalid agent signature' };
  }

  // 4. Verify report is within scope
  const scopeValid = validateReportScope(
    signedReport.report,
    agentKey.scope
  );
  if (!scopeValid) {
    return { valid: false, reason: 'Report exceeds agent scope' };
  }

  // 5. Verify agent had permissions
  const permissionValid = hasPermission(
    agentKey,
    AgentPermission.GENERATE_COMPLIANCE_REPORT
  );
  if (!permissionValid) {
    return { valid: false, reason: 'Agent lacks permission' };
  }

  // 6. Verify provider attestation (if available)
  if (agent.attestation) {
    const attestationValid = await verifyProviderAttestation(
      agent.attestation
    );
    if (!attestationValid) {
      return {
        valid: true,
        warnings: ['Provider attestation invalid or expired']
      };
    }
  }

  return {
    valid: true,
    agent,
    agentKey,
    verifiedAt: Math.floor(Date.now() / 1000)
  };
}
```

---

## 7. Revocation

### 7.1 Revocation Methods

```typescript
/**
 * Revoke agent viewing key immediately
 */
async function revokeAgentViewingKey(
  owner: ViewingKeyPair,
  keyId: AgentKeyId,
  reason: string
): Promise<RevocationResult> {
  const agentKey = await getAgentViewingKey(keyId);

  // Verify ownership
  if (!verifyOwnership(owner, agentKey)) {
    throw new Error('Not authorized to revoke this key');
  }

  // Update status
  agentKey.status = AgentKeyStatus.REVOKED;
  agentKey.revokedAt = Math.floor(Date.now() / 1000);
  agentKey.revokedBy = owner.address;
  agentKey.revocationReason = reason;

  await storeAgentViewingKey(agentKey);

  // Emit revocation event
  await emitEvent('agent_key_revoked', {
    keyId,
    agentId: agentKey.agentId,
    reason,
    revokedAt: agentKey.revokedAt
  });

  // Notify agent via webhook
  const agent = await getAgentIdentity(agentKey.agentId);
  if (agent.metadata.notificationWebhook) {
    await notifyAgent(agent.metadata.notificationWebhook, {
      event: 'key_revoked',
      keyId,
      reason
    });
  }

  return {
    success: true,
    keyId,
    revokedAt: agentKey.revokedAt
  };
}

/**
 * Suspend agent key temporarily
 */
async function suspendAgentViewingKey(
  owner: ViewingKeyPair,
  keyId: AgentKeyId,
  reason: string,
  until?: Date
): Promise<SuspensionResult> {
  const agentKey = await getAgentViewingKey(keyId);

  if (!verifyOwnership(owner, agentKey)) {
    throw new Error('Not authorized to suspend this key');
  }

  agentKey.status = AgentKeyStatus.SUSPENDED;
  agentKey.suspendedAt = Math.floor(Date.now() / 1000);
  agentKey.suspendedUntil = until
    ? Math.floor(until.getTime() / 1000)
    : undefined;
  agentKey.suspensionReason = reason;

  await storeAgentViewingKey(agentKey);

  return {
    success: true,
    keyId,
    suspendedAt: agentKey.suspendedAt,
    suspendedUntil: agentKey.suspendedUntil
  };
}

/**
 * Key rotation (revoke old, issue new)
 */
async function rotateAgentViewingKey(
  owner: ViewingKeyPair,
  keyId: AgentKeyId
): Promise<RotationResult> {
  const oldKey = await getAgentViewingKey(keyId);

  // Create new key with same params
  const newKey = await createAgentViewingKey({
    agent: await getAgentIdentity(oldKey.agentId),
    permissions: oldKey.permissions,
    scope: oldKey.scope,
    expiry: new Date(oldKey.expiresAt * 1000)
  });

  // Revoke old key
  await revokeAgentViewingKey(owner, keyId, 'Key rotated');

  return {
    success: true,
    oldKeyId: keyId,
    newKeyId: newKey.keyId
  };
}
```

### 7.2 Automatic Expiration

```typescript
/**
 * Background job to expire agent keys
 */
async function expireAgentKeys(): Promise<ExpiredKeysResult> {
  const now = Math.floor(Date.now() / 1000);

  // Find all active keys past expiry
  const expiredKeys = await findAgentKeys({
    status: AgentKeyStatus.ACTIVE,
    expiresAtBefore: now
  });

  const results: ExpiredKeyResult[] = [];

  for (const key of expiredKeys) {
    key.status = AgentKeyStatus.EXPIRED;
    await storeAgentViewingKey(key);

    // Notify agent
    const agent = await getAgentIdentity(key.agentId);
    if (agent.metadata.notificationWebhook) {
      await notifyAgent(agent.metadata.notificationWebhook, {
        event: 'key_expired',
        keyId: key.keyId
      });
    }

    results.push({
      keyId: key.keyId,
      agentId: key.agentId,
      expiredAt: now
    });
  }

  return {
    expiredCount: results.length,
    results
  };
}
```

---

## 8. Audit Trail

### 8.1 Audit Log Structure

```typescript
/**
 * Audit log entry for agent key operations
 */
interface AgentAuditLogEntry {
  /**
   * Unique log entry ID
   */
  id: string;

  /**
   * Agent key ID
   */
  keyId: AgentKeyId;

  /**
   * Agent ID
   */
  agentId: AgentId;

  /**
   * Operation type
   */
  operation: AgentOperation;

  /**
   * Timestamp
   */
  timestamp: Timestamp;

  /**
   * Request details
   */
  request: {
    endpoint: string;
    method: string;
    params?: Record<string, unknown>;
  };

  /**
   * Response summary
   */
  response: {
    success: boolean;
    resultCount?: number;
    error?: string;
  };

  /**
   * IP address (if available)
   */
  ipAddress?: string;

  /**
   * Agent credential used
   */
  credential: {
    nonce: string;
    signatureValid: boolean;
  };

  /**
   * Data accessed hash (for verification)
   */
  dataHash?: HexString;
}

enum AgentOperation {
  VIEW_BALANCE = 'view_balance',
  VIEW_TRANSACTIONS = 'view_transactions',
  SEARCH_TRANSACTIONS = 'search_transactions',
  GENERATE_REPORT = 'generate_report',
  EXPORT_DATA = 'export_data',
  GENERATE_PROOF = 'generate_proof',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe'
}
```

### 8.2 Audit Log API

```typescript
/**
 * Get audit log for agent key
 */
async function getAgentKeyAuditLog(
  keyId: AgentKeyId,
  options: AuditLogOptions = {}
): Promise<AuditLogEntry[]> {
  const query: AuditLogQuery = {
    keyId,
    startDate: options.startDate,
    endDate: options.endDate,
    operations: options.operations,
    limit: options.limit || 100,
    offset: options.offset || 0
  };

  return await queryAuditLog(query);
}

/**
 * Get usage statistics
 */
async function getAgentKeyUsage(
  keyId: AgentKeyId
): Promise<AgentKeyUsage> {
  const logs = await getAgentKeyAuditLog(keyId);

  return {
    keyId,
    totalRequests: logs.length,
    successfulRequests: logs.filter(l => l.response.success).length,
    failedRequests: logs.filter(l => !l.response.success).length,
    operationCounts: countByOperation(logs),
    lastUsed: logs.length > 0 ? logs[0].timestamp : null,
    uniqueIPs: countUniqueIPs(logs),
    peakHour: findPeakHour(logs)
  };
}
```

---

## 9. Multi-Agent Scenarios

### 9.1 Multiple Agents

```typescript
/**
 * Create viewing keys for multiple agents
 * Common in DAO setups with specialized agents
 */
async function setupMultiAgentAccess(
  owner: ViewingKeyPair,
  agents: AgentSetupConfig[]
): Promise<MultiAgentSetupResult> {
  const results: AgentSetupResult[] = [];

  for (const config of agents) {
    // Register agent if needed
    let agent = await getAgentIdentity(config.agentId);
    if (!agent) {
      agent = await registerAgent(config.registration);
    }

    // Create viewing key
    const key = await createAgentViewingKey({
      agent,
      permissions: config.permissions,
      scope: config.scope,
      expiry: config.expiry
    });

    results.push({
      agentId: agent.agentId,
      keyId: key.keyId,
      role: config.role
    });
  }

  return {
    success: true,
    agents: results
  };
}

/**
 * Example: DAO treasury multi-agent setup
 */
const daoAgentSetup: AgentSetupConfig[] = [
  {
    agentId: 'agent_eliza_treasury',
    role: 'treasury_manager',
    registration: {
      provider: AgentProvider.ELIZA,
      type: AgentType.TREASURY_MANAGER
    },
    permissions: AGENT_PERMISSION_SETS[AgentType.TREASURY_MANAGER],
    scope: {
      assets: ['SOL', 'USDC', 'BONK'],
      chains: ['solana']
    },
    expiry: new Date('2026-12-31')
  },
  {
    agentId: 'agent_custom_auditor',
    role: 'auditor',
    registration: {
      provider: AgentProvider.CUSTOM,
      type: AgentType.AUDITOR
    },
    permissions: AGENT_PERMISSION_SETS[AgentType.AUDITOR],
    scope: {
      // Full historical access for auditor
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2026-12-31')
      }
    },
    expiry: new Date('2027-03-31') // 90 days after fiscal year
  },
  {
    agentId: 'agent_goat_reporter',
    role: 'report_generator',
    registration: {
      provider: AgentProvider.GOAT,
      type: AgentType.REPORT_GENERATOR
    },
    permissions: AGENT_PERMISSION_SETS[AgentType.REPORT_GENERATOR],
    scope: {
      maxResultsPerQuery: 1000
    },
    expiry: new Date('2026-12-31')
  }
];
```

### 9.2 Agent Hierarchies

```typescript
/**
 * Parent agent can create sub-agent keys
 * Useful for agent delegation chains
 */
interface AgentHierarchy {
  /**
   * Root agent (has full delegated access)
   */
  root: AgentViewingKey;

  /**
   * Child agents (derived from root)
   */
  children: Map<AgentId, AgentViewingKey>;

  /**
   * Maximum depth of hierarchy
   */
  maxDepth: number;

  /**
   * Current depth
   */
  currentDepth: number;
}

/**
 * Create child agent from parent agent's delegation
 * Requires parent to have SUB_DELEGATE permission
 */
async function createChildAgent(
  parentKey: AgentViewingKey,
  parentKeyPair: KeyPair,
  childAgent: AgentIdentity,
  childScope: AgentScope
): Promise<AgentViewingKey> {
  // Verify parent can sub-delegate
  if (!hasPermission(parentKey, AgentPermission.SUB_DELEGATE)) {
    throw new Error('Parent agent cannot sub-delegate');
  }

  // Child scope must be subset of parent scope
  if (!isScopeSubset(childScope, parentKey.scope)) {
    throw new Error('Child scope exceeds parent scope');
  }

  // Child permissions must be subset of parent
  // (handled in createAgentViewingKey)

  // Derive child viewing key from parent's scoped key
  const parentViewingKey = await decryptViewingKey(
    parentKey.encryptedViewingKey,
    parentKeyPair.privateKey
  );

  const childViewingKey = deriveChildViewingKey(
    parentViewingKey,
    childScope,
    childAgent.agentId
  );

  // Create child agent key
  const childKey: AgentViewingKey = {
    keyId: generateAgentKeyId(),
    agentId: childAgent.agentId,
    encryptedViewingKey: await encryptForRecipient(
      childViewingKey,
      childAgent.publicKey
    ),
    permissions: filterPermissions(
      parentKey.permissions,
      [AgentPermission.SUB_DELEGATE] // Children can't sub-delegate by default
    ),
    scope: childScope,
    createdAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.min(
      parentKey.expiresAt,
      Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // Max 30 days
    ),
    status: AgentKeyStatus.ACTIVE,
    ownerSignature: signWithParentAgent(parentKeyPair, childKey),
    verification: createChildVerificationData(parentKey, childKey),
    parentKeyId: parentKey.keyId // Track hierarchy
  };

  await storeAgentViewingKey(childKey);

  return childKey;
}
```

---

## 10. Security Considerations

### 10.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Agent key theft | Keys encrypted for specific agent; useless without agent private key |
| Rogue agent access | Scoped access, time-bound expiry, revocation capability |
| Replay attacks | Nonces, timestamps, signature verification |
| Scope escalation | Cryptographic scope enforcement via derived keys |
| Provider impersonation | Provider attestation verification |
| Audit log tampering | Append-only log, hash chains, optional on-chain anchoring |

### 10.2 Best Practices

```typescript
/**
 * Security best practices for agent viewing keys
 */
const AGENT_KEY_BEST_PRACTICES = {
  // Maximum key lifetime
  MAX_KEY_LIFETIME_DAYS: 365,

  // Default key lifetime
  DEFAULT_KEY_LIFETIME_DAYS: 90,

  // Minimum key lifetime (prevent instant expiry attacks)
  MIN_KEY_LIFETIME_HOURS: 1,

  // Agent key must be revocable
  REQUIRE_REVOCABLE: true,

  // Require agent signature for each request
  REQUIRE_REQUEST_SIGNATURES: true,

  // Maximum concurrent keys per agent
  MAX_KEYS_PER_AGENT: 5,

  // Rate limit (requests per hour)
  DEFAULT_RATE_LIMIT: 1000,
  MAX_RATE_LIMIT: 10000,

  // Require provider attestation for production
  REQUIRE_ATTESTATION_PRODUCTION: true,

  // Permissions that require explicit approval
  SENSITIVE_PERMISSIONS: [
    AgentPermission.EXPORT_CSV,
    AgentPermission.EXPORT_PDF,
    AgentPermission.GENERATE_SOLVENCY_PROOF
  ],

  // Maximum results per query
  MAX_RESULTS_PER_QUERY: 10000,

  // Audit log retention (days)
  AUDIT_LOG_RETENTION_DAYS: 2555 // ~7 years
};
```

### 10.3 Rate Limiting

```typescript
/**
 * Rate limiter for agent requests
 */
class AgentRateLimiter {
  private counters: Map<AgentKeyId, RateLimitCounter> = new Map();

  async checkRateLimit(keyId: AgentKeyId): Promise<RateLimitResult> {
    const agentKey = await getAgentViewingKey(keyId);
    const limit = agentKey.scope.rateLimit ||
      AGENT_KEY_BEST_PRACTICES.DEFAULT_RATE_LIMIT;

    let counter = this.counters.get(keyId);
    if (!counter || this.isExpired(counter)) {
      counter = { count: 0, windowStart: Date.now() };
      this.counters.set(keyId, counter);
    }

    if (counter.count >= limit) {
      return {
        allowed: false,
        retryAfter: this.getWindowEnd(counter) - Date.now(),
        limit,
        remaining: 0
      };
    }

    counter.count++;

    return {
      allowed: true,
      limit,
      remaining: limit - counter.count
    };
  }

  private isExpired(counter: RateLimitCounter): boolean {
    return Date.now() - counter.windowStart > 3600000; // 1 hour
  }

  private getWindowEnd(counter: RateLimitCounter): number {
    return counter.windowStart + 3600000;
  }
}
```

---

## 11. SDK Integration

### 11.1 TypeScript SDK

```typescript
import { SIP, AgentViewingKeyAPI } from '@sip-protocol/sdk';

// Owner creates agent viewing key
const sip = new SIP({ chain: 'solana', viewingKeyPair });

const agentKey = await sip.agents.createViewingKey({
  agent: {
    agentId: 'agent_eliza_treasury_001',
    provider: 'eliza',
    type: 'treasury_manager',
    publicKey: agentPublicKey
  },
  permissions: [
    'view_balance',
    'view_transactions',
    'generate_reports'
  ],
  scope: {
    assets: ['SOL', 'USDC'],
    chains: ['solana']
  },
  expiry: new Date('2026-12-31')
});

console.log('Agent key created:', agentKey.keyId);

// Agent uses the key
const agentSip = new SIP({
  chain: 'solana',
  agentKey: agentKey.encryptedViewingKey,
  agentKeyPair // Agent's keypair for signing requests
});

// View balance
const balance = await agentSip.getShieldedBalance();

// Get transactions
const txs = await agentSip.getTransactionHistory({ limit: 100 });

// Generate compliance report
const report = await agentSip.generateComplianceReport({
  period: '2026-Q1',
  format: 'pdf'
});

// Owner revokes key
await sip.agents.revokeViewingKey(agentKey.keyId, 'Agent decommissioned');
```

### 11.2 React Hooks

```tsx
import {
  useAgentViewingKeys,
  useCreateAgentViewingKey,
  useRevokeAgentViewingKey,
  useAgentKeyUsage
} from '@sip-protocol/react';

function AgentKeyManager() {
  const { agentKeys, isLoading } = useAgentViewingKeys();
  const { createKey, isPending } = useCreateAgentViewingKey();
  const { revokeKey } = useRevokeAgentViewingKey();

  const handleCreate = async () => {
    await createKey({
      agent: {
        agentId: 'agent_custom_001',
        provider: 'custom',
        type: 'treasury_manager',
        publicKey: '0x...'
      },
      permissions: ['view_balance', 'view_transactions'],
      scope: { assets: ['SOL'] },
      expiry: new Date('2026-12-31')
    });
  };

  return (
    <div>
      <h2>Agent Viewing Keys</h2>
      {agentKeys.map(key => (
        <AgentKeyCard
          key={key.keyId}
          agentKey={key}
          onRevoke={() => revokeKey(key.keyId, 'User requested')}
        />
      ))}
      <button onClick={handleCreate} disabled={isPending}>
        Create Agent Key
      </button>
    </div>
  );
}

function AgentKeyCard({ agentKey, onRevoke }) {
  const { usage } = useAgentKeyUsage(agentKey.keyId);

  return (
    <div className="agent-key-card">
      <h3>{agentKey.agentId}</h3>
      <p>Status: {agentKey.status}</p>
      <p>Expires: {new Date(agentKey.expiresAt * 1000).toLocaleDateString()}</p>
      <p>Total Requests: {usage?.totalRequests || 0}</p>
      <p>Last Used: {usage?.lastUsed
        ? new Date(usage.lastUsed * 1000).toLocaleString()
        : 'Never'
      }</p>
      <button onClick={onRevoke}>Revoke</button>
    </div>
  );
}
```

### 11.3 CLI

```bash
# Register an agent
sip agent register \
  --provider eliza \
  --type treasury_manager \
  --public-key 0x... \
  --name "Treasury Bot 001"

# Create agent viewing key
sip agent create-key \
  --agent-id agent_eliza_treasury_001 \
  --permissions view_balance,view_transactions,generate_reports \
  --scope-assets SOL,USDC \
  --expiry 2026-12-31

# List agent keys
sip agent list-keys

# Get key usage
sip agent usage agentkey_abc123

# Get audit log
sip agent audit-log agentkey_abc123 --limit 100

# Revoke key
sip agent revoke-key agentkey_abc123 --reason "Agent decommissioned"

# Rotate key
sip agent rotate-key agentkey_abc123
```

---

## 12. Reference Implementation

### 12.1 Core Classes

```typescript
// packages/sdk/src/agents/agent-viewing-key-api.ts

export class AgentViewingKeyAPIImpl implements AgentViewingKeyAPI {
  private storage: AgentKeyStorage;
  private rateLimiter: AgentRateLimiter;

  constructor(options: AgentAPIOptions) {
    this.storage = options.storage || new InMemoryAgentKeyStorage();
    this.rateLimiter = new AgentRateLimiter();
  }

  async createAgentViewingKey(
    params: CreateAgentViewingKeyParams
  ): Promise<AgentViewingKey> {
    // Validate params
    this.validateCreateParams(params);

    // Validate agent
    await this.validateAgent(params.agent);

    // Validate permissions for agent type
    this.validatePermissions(params.agent.type, params.permissions);

    // Derive scoped viewing key
    const scopedKey = deriveScopedViewingKey(
      this.viewingKeyPair,
      agentScopeToScope(params.scope),
      params.agent.agentId
    );

    // Encrypt for agent
    const encryptedKey = await encryptForRecipient(
      scopedKey.privateKey,
      params.agent.publicKey
    );

    // Create key object
    const agentKey: AgentViewingKey = {
      keyId: this.generateKeyId(),
      agentId: params.agent.agentId,
      encryptedViewingKey: encryptedKey,
      permissions: params.permissions,
      scope: params.scope,
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(params.expiry.getTime() / 1000),
      status: AgentKeyStatus.ACTIVE,
      ownerSignature: this.signKey(agentKey),
      verification: this.createVerification(params.agent, agentKey)
    };

    // Store
    await this.storage.save(agentKey);

    // Log creation
    await this.logOperation({
      keyId: agentKey.keyId,
      agentId: agentKey.agentId,
      operation: 'key_created',
      timestamp: agentKey.createdAt
    });

    return agentKey;
  }

  async verifyAgentViewingKey(
    keyId: AgentKeyId,
    agentSignature?: Signature
  ): Promise<VerificationResult> {
    const key = await this.storage.get(keyId);
    if (!key) {
      return { valid: false, reason: 'Key not found' };
    }

    // Check status
    if (key.status !== AgentKeyStatus.ACTIVE) {
      return { valid: false, reason: `Key status: ${key.status}` };
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (key.expiresAt < now) {
      // Auto-expire
      key.status = AgentKeyStatus.EXPIRED;
      await this.storage.save(key);
      return { valid: false, reason: 'Key expired' };
    }

    // Verify agent signature if provided
    if (agentSignature) {
      const agent = await getAgentIdentity(key.agentId);
      if (!agent) {
        return { valid: false, reason: 'Agent not found' };
      }

      const signatureValid = verify(
        agentSignature,
        createVerificationMessage(keyId),
        agent.publicKey
      );

      if (!signatureValid) {
        return { valid: false, reason: 'Invalid agent signature' };
      }
    }

    return {
      valid: true,
      key,
      permissions: key.permissions,
      scope: key.scope
    };
  }

  async revokeAgentViewingKey(
    keyId: AgentKeyId,
    reason: string
  ): Promise<RevocationResult> {
    const key = await this.storage.get(keyId);
    if (!key) {
      throw new Error('Key not found');
    }

    key.status = AgentKeyStatus.REVOKED;
    key.revokedAt = Math.floor(Date.now() / 1000);
    key.revocationReason = reason;

    await this.storage.save(key);

    await this.logOperation({
      keyId,
      agentId: key.agentId,
      operation: 'key_revoked',
      timestamp: key.revokedAt,
      details: { reason }
    });

    return {
      success: true,
      keyId,
      revokedAt: key.revokedAt
    };
  }

  private generateKeyId(): AgentKeyId {
    const random = new Uint8Array(16);
    crypto.getRandomValues(random);
    return `agentkey_${bytesToHex(random)}` as AgentKeyId;
  }

  private validateCreateParams(params: CreateAgentViewingKeyParams): void {
    const { MAX_KEY_LIFETIME_DAYS, MIN_KEY_LIFETIME_HOURS } =
      AGENT_KEY_BEST_PRACTICES;

    const expiryMs = params.expiry.getTime() - Date.now();

    if (expiryMs < MIN_KEY_LIFETIME_HOURS * 60 * 60 * 1000) {
      throw new Error(`Key must be valid for at least ${MIN_KEY_LIFETIME_HOURS} hours`);
    }

    if (expiryMs > MAX_KEY_LIFETIME_DAYS * 24 * 60 * 60 * 1000) {
      throw new Error(`Key cannot be valid for more than ${MAX_KEY_LIFETIME_DAYS} days`);
    }
  }
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | January 2026 | Initial specification |

---

## References

1. [a16z Big Ideas 2026 - Know Your Agent](https://a16z.com/big-ideas-2026)
2. [SIP-003: Viewing Key Standard](./sip-eips/SIP-003-VIEWING-KEYS.md)
3. [Time-Bound Delegation Specification](./TIME-BOUND-DELEGATION.md)
4. [GOAT SDK Documentation](https://github.com/GOAT-AI/goat-sdk)
5. [ai16z Eliza Framework](https://github.com/ai16z/eliza)

---

**Document Version:** 1.0.0
**Last Updated:** January 2026
