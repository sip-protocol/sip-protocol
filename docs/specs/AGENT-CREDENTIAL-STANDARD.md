# Agent Credential Standard (Know Your Agent)

**SIP-KYA-001**
**Version:** 1.0.0
**Status:** Draft Standard
**Created:** January 2026
**Authors:** SIP Protocol Team

---

## Abstract

This specification defines a cryptographic credential standard for autonomous AI agents operating in blockchain ecosystems. As AI agents increasingly manage treasuries, execute trades, and handle compliance, there is a critical need for verifiable agent identity, principal accountability, and scoped authorization. This standard implements the "Know Your Agent" (KYA) framework, enabling institutions and DAOs to safely delegate viewing and operational authority to AI agents.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Terminology](#2-terminology)
3. [Agent Identity](#3-agent-identity)
4. [Credential Structure](#4-credential-structure)
5. [Principal-Agent Binding](#5-principal-agent-binding)
6. [Credential Lifecycle](#6-credential-lifecycle)
7. [Viewing Key Integration](#7-viewing-key-integration)
8. [Compliance Framework](#8-compliance-framework)
9. [Security Considerations](#9-security-considerations)
10. [Registry Specification](#10-registry-specification)
11. [SDK Reference](#11-sdk-reference)
12. [Test Vectors](#12-test-vectors)

---

## 1. Introduction

### 1.1 Motivation

> "Know your agent: agents will need cryptographically signed credentials to transact."
> — a16z Big Ideas 2026

The rapid advancement of AI agents creates new challenges for blockchain ecosystems:

- **Identity**: How do we identify and verify autonomous agents?
- **Accountability**: Who is responsible when an agent acts?
- **Authorization**: What can an agent do, and for how long?
- **Auditability**: How do we track and verify agent actions?

### 1.2 Goals

This standard aims to:

1. **Define Agent Identity**: Decentralized identifiers (DIDs) for AI agents
2. **Enable Verifiable Credentials**: Cryptographic proofs of agent authorization
3. **Establish Principal Binding**: Link agents to accountable human/org principals
4. **Support Scoped Authorization**: Time-bound, permission-limited credentials
5. **Ensure Compliance**: Audit trails and regulatory alignment

### 1.3 Scope

This standard covers:
- Agent identity creation and verification
- Credential issuance, delegation, and revocation
- Integration with SIP viewing keys
- Compliance reporting for agent actions

Out of scope:
- Agent execution environments
- AI model specifications
- Specific agent frameworks (covered in implementation guides)

### 1.4 Relationship to Other Standards

| Standard | Relationship |
|----------|--------------|
| W3C DIDs | Agent identity format based on DID specification |
| W3C VCs | Credential format compatible with Verifiable Credentials |
| SIP-003 | Viewing key integration for agent access |
| EIP-5564 | Stealth address compatibility |
| CAIP-10 | Multi-chain account identification |

---

## 2. Terminology

| Term | Definition |
|------|------------|
| **Agent** | An autonomous software entity capable of performing actions on behalf of a principal |
| **Principal** | The human, organization, or entity accountable for an agent's actions |
| **Credential** | A cryptographic attestation of an agent's identity and authorizations |
| **Issuer** | The entity that creates and signs agent credentials |
| **Verifier** | Any entity that validates agent credentials |
| **Registry** | On-chain or off-chain storage of agent credentials and revocations |
| **Scope** | The bounded permissions and constraints on an agent's actions |
| **Attestation** | A signed statement about an agent's properties or capabilities |

---

## 3. Agent Identity

### 3.1 Agent DID Format

Agents are identified using Decentralized Identifiers (DIDs) following the W3C DID specification with a custom `agent` method:

```
did:agent:<provider>:<unique-id>
```

**Components:**
- `did:agent:` - Method prefix identifying this as an agent DID
- `<provider>` - Agent provider/framework identifier
- `<unique-id>` - Provider-specific unique identifier

**Examples:**
```
did:agent:anthropic:claude-treasury-001
did:agent:openai:gpt-finance-abc123
did:agent:eliza:dao-manager-xyz789
did:agent:goat:trading-bot-qrs456
did:agent:custom:enterprise-agent-001
```

### 3.2 Agent DID Document

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://sip-protocol.org/ns/agent/v1"
  ],
  "id": "did:agent:anthropic:claude-treasury-001",
  "controller": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",

  "verificationMethod": [
    {
      "id": "did:agent:anthropic:claude-treasury-001#signing-key-1",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:agent:anthropic:claude-treasury-001",
      "publicKeyHex": "02a1b2c3d4e5f6..."
    }
  ],

  "authentication": [
    "did:agent:anthropic:claude-treasury-001#signing-key-1"
  ],

  "service": [
    {
      "id": "did:agent:anthropic:claude-treasury-001#agent-endpoint",
      "type": "AgentService",
      "serviceEndpoint": "https://api.anthropic.com/agents/claude-treasury-001"
    }
  ],

  "agentMetadata": {
    "provider": "anthropic",
    "agentType": "treasury_manager",
    "capabilities": ["view_balance", "generate_reports", "analyze_transactions"],
    "createdAt": "2026-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

### 3.3 Agent Types

```typescript
/**
 * Standard agent type classifications
 */
enum AgentType {
  // Financial Operations
  TREASURY_MANAGER = 'treasury_manager',
  PAYMENT_PROCESSOR = 'payment_processor',
  YIELD_OPTIMIZER = 'yield_optimizer',
  PORTFOLIO_MANAGER = 'portfolio_manager',

  // Trading
  MARKET_MAKER = 'market_maker',
  ARBITRAGE_BOT = 'arbitrage_bot',
  TRADING_AGENT = 'trading_agent',

  // Compliance & Audit
  COMPLIANCE_MONITOR = 'compliance_monitor',
  AUDITOR = 'auditor',
  REPORT_GENERATOR = 'report_generator',
  SANCTIONS_SCREENER = 'sanctions_screener',

  // Operations
  INVOICE_PROCESSOR = 'invoice_processor',
  PAYROLL_AGENT = 'payroll_agent',
  GOVERNANCE_AGENT = 'governance_agent',

  // General
  GENERAL_PURPOSE = 'general_purpose',
  CUSTOM = 'custom'
}
```

### 3.4 Provider Registry

```typescript
/**
 * Known agent providers with verification endpoints
 */
const AGENT_PROVIDER_REGISTRY: Record<string, ProviderInfo> = {
  // Major AI Providers
  'anthropic': {
    name: 'Anthropic',
    verificationEndpoint: 'https://api.anthropic.com/v1/agents/verify',
    publicKeys: ['0x04abc...', '0x04def...'],
    attestationSupported: true
  },
  'openai': {
    name: 'OpenAI',
    verificationEndpoint: 'https://api.openai.com/v1/agents/verify',
    publicKeys: ['0x04123...'],
    attestationSupported: true
  },

  // Crypto-Native Agent Frameworks
  'eliza': {
    name: 'ai16z Eliza',
    verificationEndpoint: 'https://eliza.ai16z.com/verify',
    publicKeys: ['0x04789...'],
    attestationSupported: true
  },
  'goat': {
    name: 'GOAT SDK',
    verificationEndpoint: 'https://goat.ohmygoat.dev/verify',
    publicKeys: ['0x04abc...'],
    attestationSupported: true
  },
  'brian': {
    name: 'Brian AI',
    verificationEndpoint: 'https://brian.ai/verify',
    publicKeys: ['0x04def...'],
    attestationSupported: true
  },

  // Self-Hosted / Custom
  'custom': {
    name: 'Custom Agent',
    verificationEndpoint: null,
    publicKeys: [], // Must be provided per-instance
    attestationSupported: false
  }
};
```

---

## 4. Credential Structure

### 4.1 Agent Credential

```typescript
/**
 * Agent Credential following W3C Verifiable Credentials structure
 */
interface AgentCredential {
  /**
   * JSON-LD context
   */
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    'https://sip-protocol.org/ns/agent-credential/v1'
  ];

  /**
   * Credential identifier
   */
  id: CredentialId;

  /**
   * Credential types
   */
  type: ['VerifiableCredential', 'AgentCredential'];

  /**
   * Credential issuer (principal)
   */
  issuer: {
    id: DID;
    name?: string;
  };

  /**
   * Issuance date
   */
  issuanceDate: ISO8601DateTime;

  /**
   * Expiration date (required for agents)
   */
  expirationDate: ISO8601DateTime;

  /**
   * Credential subject (agent)
   */
  credentialSubject: {
    /**
     * Agent DID
     */
    id: AgentDID;

    /**
     * Agent type
     */
    agentType: AgentType;

    /**
     * Agent provider
     */
    provider: string;

    /**
     * Granted permissions
     */
    permissions: AgentPermission[];

    /**
     * Scope limitations
     */
    scope: AgentScope;

    /**
     * Principal binding
     */
    principal: PrincipalBinding;

    /**
     * Provider attestation (optional)
     */
    providerAttestation?: ProviderAttestation;
  };

  /**
   * Credential status (for revocation checking)
   */
  credentialStatus: {
    id: string;
    type: 'RevocationList2023' | 'StatusList2021';
  };

  /**
   * Cryptographic proof
   */
  proof: CredentialProof;
}

type CredentialId = `urn:uuid:${string}`;
type AgentDID = `did:agent:${string}:${string}`;
type DID = string;
type ISO8601DateTime = string;
```

### 4.2 Credential Proof

```typescript
/**
 * Cryptographic proof for credential
 */
interface CredentialProof {
  /**
   * Proof type
   */
  type: 'EcdsaSecp256k1Signature2019' | 'Ed25519Signature2020';

  /**
   * Creation timestamp
   */
  created: ISO8601DateTime;

  /**
   * Verification method (principal's key)
   */
  verificationMethod: string;

  /**
   * Proof purpose
   */
  proofPurpose: 'assertionMethod';

  /**
   * Signature value
   */
  proofValue: string;
}
```

### 4.3 Example Credential

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://sip-protocol.org/ns/agent-credential/v1"
  ],
  "id": "urn:uuid:3978344f-8596-4c3a-a978-8fcaba3903c5",
  "type": ["VerifiableCredential", "AgentCredential"],
  "issuer": {
    "id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "name": "Acme DAO Treasury"
  },
  "issuanceDate": "2026-01-15T10:30:00Z",
  "expirationDate": "2026-12-31T23:59:59Z",
  "credentialSubject": {
    "id": "did:agent:anthropic:claude-treasury-001",
    "agentType": "treasury_manager",
    "provider": "anthropic",
    "permissions": [
      "view_balance",
      "view_transactions",
      "generate_reports",
      "analyze_patterns"
    ],
    "scope": {
      "assets": ["SOL", "USDC"],
      "chains": ["solana"],
      "maxTransactionValue": "100000000000",
      "dateRange": {
        "start": "2026-01-01T00:00:00Z",
        "end": "2026-12-31T23:59:59Z"
      }
    },
    "principal": {
      "type": "organization",
      "id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      "name": "Acme DAO",
      "liability": "full",
      "contactEmail": "treasury@acmedao.org"
    },
    "providerAttestation": {
      "provider": "anthropic",
      "attestedAt": "2026-01-15T10:00:00Z",
      "signature": "0x..."
    }
  },
  "credentialStatus": {
    "id": "https://registry.sip-protocol.org/credentials/status/3978344f",
    "type": "RevocationList2023"
  },
  "proof": {
    "type": "EcdsaSecp256k1Signature2019",
    "created": "2026-01-15T10:30:00Z",
    "verificationMethod": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK#key-1",
    "proofPurpose": "assertionMethod",
    "proofValue": "z58DAdFfa9SkqZMVPxAQpic7ndTh..."
  }
}
```

---

## 5. Principal-Agent Binding

### 5.1 Principal Types

```typescript
/**
 * Types of principals that can authorize agents
 */
enum PrincipalType {
  /**
   * Individual human
   */
  INDIVIDUAL = 'individual',

  /**
   * Registered organization
   */
  ORGANIZATION = 'organization',

  /**
   * DAO with on-chain governance
   */
  DAO = 'dao',

  /**
   * Multi-sig wallet
   */
  MULTISIG = 'multisig',

  /**
   * Smart contract
   */
  CONTRACT = 'contract'
}

/**
 * Principal binding in credential
 */
interface PrincipalBinding {
  /**
   * Principal type
   */
  type: PrincipalType;

  /**
   * Principal identifier (DID or address)
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Liability model
   */
  liability: LiabilityModel;

  /**
   * Contact information for accountability
   */
  contactEmail?: string;
  contactPhone?: string;

  /**
   * Jurisdiction (for legal entities)
   */
  jurisdiction?: string;

  /**
   * Registration number (for organizations)
   */
  registrationNumber?: string;

  /**
   * For DAOs: governance contract address
   */
  governanceContract?: string;

  /**
   * For multi-sig: signer configuration
   */
  multisigConfig?: {
    threshold: number;
    signers: string[];
  };
}

/**
 * Liability models for agent actions
 */
enum LiabilityModel {
  /**
   * Principal assumes full liability for agent actions
   */
  FULL = 'full',

  /**
   * Liability limited to specific scope
   */
  LIMITED = 'limited',

  /**
   * Shared liability with agent provider
   */
  SHARED = 'shared',

  /**
   * Liability covered by insurance
   */
  INSURED = 'insured'
}
```

### 5.2 Binding Verification

```typescript
/**
 * Verify principal-agent binding
 */
async function verifyPrincipalBinding(
  credential: AgentCredential
): Promise<BindingVerificationResult> {
  const principal = credential.credentialSubject.principal;

  switch (principal.type) {
    case PrincipalType.INDIVIDUAL:
      return verifyIndividualBinding(principal);

    case PrincipalType.ORGANIZATION:
      return verifyOrganizationBinding(principal);

    case PrincipalType.DAO:
      return verifyDAOBinding(principal);

    case PrincipalType.MULTISIG:
      return verifyMultisigBinding(principal);

    case PrincipalType.CONTRACT:
      return verifyContractBinding(principal);

    default:
      return { valid: false, reason: 'Unknown principal type' };
  }
}

/**
 * Verify DAO principal binding
 */
async function verifyDAOBinding(
  principal: PrincipalBinding
): Promise<BindingVerificationResult> {
  // 1. Verify governance contract exists
  const contract = await getContract(
    principal.governanceContract,
    principal.jurisdiction // chain
  );

  if (!contract) {
    return { valid: false, reason: 'Governance contract not found' };
  }

  // 2. Check if credential issuance was approved by governance
  // This could be via proposal or delegated authority
  const authorized = await contract.isAgentAuthorized(
    credential.credentialSubject.id
  );

  if (!authorized) {
    return { valid: false, reason: 'Agent not authorized by DAO governance' };
  }

  // 3. Verify the signing key has delegation authority
  const signerAuthorized = await contract.canSignAgentCredentials(
    credential.issuer.id
  );

  if (!signerAuthorized) {
    return { valid: false, reason: 'Issuer not authorized to sign credentials' };
  }

  return {
    valid: true,
    principal,
    verifiedAt: Date.now()
  };
}
```

### 5.3 Accountability Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ACCOUNTABILITY CHAIN                                 │
└─────────────────────────────────────────────────────────────────────────────┘

   HUMAN/LEGAL ENTITY                    AGENT                    ACTION
┌──────────────────────┐           ┌──────────────────┐     ┌──────────────┐
│                      │  issues   │                  │     │              │
│     Principal        ├──────────►│     Agent        ├────►│   Action     │
│                      │credential │                  │signs│              │
│  (Legally Liable)    │           │ (Cryptographic   │     │(Audit Trail) │
│                      │           │    Identity)     │     │              │
└──────────┬───────────┘           └────────┬─────────┘     └──────┬───────┘
           │                                │                      │
           │                                │                      │
           ▼                                ▼                      ▼
┌──────────────────────┐           ┌──────────────────┐     ┌──────────────┐
│  Credential proves   │           │  Every action    │     │   Actions    │
│  binding between     │           │  signed with     │     │  traceable   │
│  principal & agent   │           │  agent key       │     │  to agent    │
└──────────────────────┘           └──────────────────┘     └──────────────┘
           │                                │                      │
           └────────────────────────────────┴──────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │     FULL ACCOUNTABILITY       │
                    │                               │
                    │  Agent action → Agent DID →   │
                    │  Credential → Principal →     │
                    │  Human/Legal Entity           │
                    └───────────────────────────────┘
```

---

## 6. Credential Lifecycle

### 6.1 Lifecycle States

```
                    ┌───────────┐
                    │  PENDING  │
                    │ (Created) │
                    └─────┬─────┘
                          │
                          │ Principal signs
                          ▼
                    ┌───────────┐
                    │  ACTIVE   │◄────────────────┐
                    │           │                 │
                    └─────┬─────┘                 │
                          │                       │
         ┌────────────────┼────────────────┐      │
         │                │                │      │
         ▼                ▼                ▼      │ Unsuspend
   ┌───────────┐    ┌───────────┐    ┌───────────┐│
   │  EXPIRED  │    │  REVOKED  │    │ SUSPENDED ├┘
   └───────────┘    └───────────┘    └───────────┘
```

### 6.2 Issuance Flow

```typescript
/**
 * Issue agent credential
 */
async function issueAgentCredential(
  params: IssueCredentialParams
): Promise<AgentCredential> {
  // 1. Validate agent identity
  const agentValid = await validateAgentIdentity(params.agentDID);
  if (!agentValid) {
    throw new Error('Invalid agent identity');
  }

  // 2. Verify provider attestation (if provided)
  if (params.providerAttestation) {
    const attestationValid = await verifyProviderAttestation(
      params.agentDID,
      params.providerAttestation
    );
    if (!attestationValid) {
      throw new Error('Invalid provider attestation');
    }
  }

  // 3. Validate permissions for agent type
  validatePermissionsForType(params.agentType, params.permissions);

  // 4. Create credential
  const credentialId = generateCredentialId();
  const credential: AgentCredential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://sip-protocol.org/ns/agent-credential/v1'
    ],
    id: credentialId,
    type: ['VerifiableCredential', 'AgentCredential'],
    issuer: {
      id: params.principalDID,
      name: params.principalName
    },
    issuanceDate: new Date().toISOString(),
    expirationDate: params.expirationDate.toISOString(),
    credentialSubject: {
      id: params.agentDID,
      agentType: params.agentType,
      provider: extractProvider(params.agentDID),
      permissions: params.permissions,
      scope: params.scope,
      principal: params.principalBinding,
      providerAttestation: params.providerAttestation
    },
    credentialStatus: {
      id: `${REGISTRY_URL}/credentials/status/${credentialId}`,
      type: 'RevocationList2023'
    },
    proof: null! // Will be set by signing
  };

  // 5. Sign credential
  credential.proof = await signCredential(
    credential,
    params.principalPrivateKey
  );

  // 6. Register credential
  await registerCredential(credential);

  // 7. Notify agent (if endpoint available)
  await notifyAgentOfCredential(params.agentDID, credential);

  return credential;
}
```

### 6.3 Revocation

```typescript
/**
 * Revocation reasons
 */
enum RevocationReason {
  /**
   * Principal initiated revocation
   */
  PRINCIPAL_REVOKED = 'principal_revoked',

  /**
   * Agent compromised
   */
  AGENT_COMPROMISED = 'agent_compromised',

  /**
   * Policy violation
   */
  POLICY_VIOLATION = 'policy_violation',

  /**
   * Scope exceeded
   */
  SCOPE_EXCEEDED = 'scope_exceeded',

  /**
   * Provider terminated
   */
  PROVIDER_TERMINATED = 'provider_terminated',

  /**
   * Regulatory requirement
   */
  REGULATORY_REQUIREMENT = 'regulatory_requirement',

  /**
   * Key rotation
   */
  KEY_ROTATION = 'key_rotation'
}

/**
 * Revoke agent credential
 */
async function revokeAgentCredential(
  credentialId: CredentialId,
  reason: RevocationReason,
  revokerDID: DID
): Promise<RevocationResult> {
  // 1. Get credential
  const credential = await getCredential(credentialId);
  if (!credential) {
    throw new Error('Credential not found');
  }

  // 2. Verify revoker is authorized
  const authorized = await canRevoke(revokerDID, credential);
  if (!authorized) {
    throw new Error('Not authorized to revoke this credential');
  }

  // 3. Create revocation entry
  const revocation: RevocationEntry = {
    credentialId,
    revokedAt: new Date().toISOString(),
    reason,
    revokedBy: revokerDID,
    signature: await signRevocation(credentialId, reason, revokerDID)
  };

  // 4. Update revocation list
  await updateRevocationList(credentialId, revocation);

  // 5. Notify agent
  await notifyAgentOfRevocation(credential.credentialSubject.id, revocation);

  // 6. Emit event
  await emitEvent('credential.revoked', {
    credentialId,
    agentDID: credential.credentialSubject.id,
    reason,
    revokedAt: revocation.revokedAt
  });

  return {
    success: true,
    revocation
  };
}
```

### 6.4 Verification

```typescript
/**
 * Verify agent credential
 */
async function verifyAgentCredential(
  credential: AgentCredential
): Promise<CredentialVerificationResult> {
  const errors: VerificationError[] = [];
  const warnings: VerificationWarning[] = [];

  // 1. Verify structure
  if (!isValidCredentialStructure(credential)) {
    errors.push({ code: 'INVALID_STRUCTURE', message: 'Invalid credential structure' });
  }

  // 2. Verify signature
  const signatureValid = await verifyCredentialSignature(credential);
  if (!signatureValid) {
    errors.push({ code: 'INVALID_SIGNATURE', message: 'Credential signature invalid' });
  }

  // 3. Check expiration
  const now = new Date();
  const expiration = new Date(credential.expirationDate);
  if (expiration < now) {
    errors.push({ code: 'EXPIRED', message: 'Credential has expired' });
  }

  // 4. Check revocation status
  const revocationStatus = await checkRevocationStatus(credential.id);
  if (revocationStatus.revoked) {
    errors.push({
      code: 'REVOKED',
      message: `Credential revoked: ${revocationStatus.reason}`
    });
  }

  // 5. Verify principal binding
  const bindingResult = await verifyPrincipalBinding(credential);
  if (!bindingResult.valid) {
    errors.push({
      code: 'INVALID_BINDING',
      message: bindingResult.reason
    });
  }

  // 6. Verify provider attestation (if present)
  if (credential.credentialSubject.providerAttestation) {
    const attestationValid = await verifyProviderAttestation(
      credential.credentialSubject.id,
      credential.credentialSubject.providerAttestation
    );
    if (!attestationValid) {
      warnings.push({
        code: 'ATTESTATION_INVALID',
        message: 'Provider attestation could not be verified'
      });
    }
  } else {
    warnings.push({
      code: 'NO_ATTESTATION',
      message: 'No provider attestation present'
    });
  }

  // 7. Verify agent identity
  const agentValid = await validateAgentIdentity(credential.credentialSubject.id);
  if (!agentValid) {
    errors.push({
      code: 'INVALID_AGENT',
      message: 'Agent identity could not be verified'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    credential,
    verifiedAt: now.toISOString()
  };
}
```

---

## 7. Viewing Key Integration

### 7.1 Agent Viewing Key Delegation

```typescript
/**
 * Create viewing key delegation bound to agent credential
 */
interface AgentViewingKeyDelegation {
  /**
   * Delegation identifier
   */
  id: DelegationId;

  /**
   * Reference to agent credential
   */
  credentialRef: {
    credentialId: CredentialId;
    credentialHash: HexString;
  };

  /**
   * Agent receiving delegation
   */
  agentDID: AgentDID;

  /**
   * Encrypted viewing key for agent
   */
  encryptedViewingKey: EncryptedKey;

  /**
   * Permissions (must be subset of credential permissions)
   */
  permissions: ViewingPermission[];

  /**
   * Scope (must be subset of credential scope)
   */
  scope: ViewingScope;

  /**
   * Expiration (must be <= credential expiration)
   */
  expiresAt: Timestamp;

  /**
   * Principal signature authorizing delegation
   */
  principalSignature: Signature;

  /**
   * Credential proof (proves credential is valid)
   */
  credentialProof: CredentialProof;
}

/**
 * Create agent viewing key delegation
 */
async function createAgentViewingKeyDelegation(
  credential: AgentCredential,
  viewingKeyPair: ViewingKeyPair,
  delegationParams: DelegationParams
): Promise<AgentViewingKeyDelegation> {
  // 1. Verify credential is valid
  const credentialValid = await verifyAgentCredential(credential);
  if (!credentialValid.valid) {
    throw new Error(`Invalid credential: ${credentialValid.errors[0].message}`);
  }

  // 2. Verify delegation scope is within credential scope
  if (!isScopeSubset(delegationParams.scope, credential.credentialSubject.scope)) {
    throw new Error('Delegation scope exceeds credential scope');
  }

  // 3. Verify delegation permissions are within credential permissions
  const invalidPermissions = delegationParams.permissions.filter(
    p => !credential.credentialSubject.permissions.includes(p)
  );
  if (invalidPermissions.length > 0) {
    throw new Error(`Permissions exceed credential: ${invalidPermissions.join(', ')}`);
  }

  // 4. Verify expiration is within credential expiration
  const credentialExpiry = new Date(credential.expirationDate).getTime();
  if (delegationParams.expiresAt > credentialExpiry) {
    throw new Error('Delegation expiration exceeds credential expiration');
  }

  // 5. Get agent public key
  const agentDoc = await resolveAgentDID(credential.credentialSubject.id);
  const agentPublicKey = agentDoc.verificationMethod[0].publicKeyHex;

  // 6. Derive scoped viewing key
  const scopedKey = deriveScopedViewingKey(
    viewingKeyPair,
    delegationParams.scope,
    credential.credentialSubject.id
  );

  // 7. Encrypt for agent
  const encryptedKey = await encryptForRecipient(
    scopedKey.privateKey,
    agentPublicKey
  );

  // 8. Create delegation
  const delegation: AgentViewingKeyDelegation = {
    id: generateDelegationId(),
    credentialRef: {
      credentialId: credential.id,
      credentialHash: hashCredential(credential)
    },
    agentDID: credential.credentialSubject.id,
    encryptedViewingKey: encryptedKey,
    permissions: delegationParams.permissions,
    scope: delegationParams.scope,
    expiresAt: delegationParams.expiresAt,
    principalSignature: await signDelegation(delegationParams),
    credentialProof: credential.proof
  };

  // 9. Store delegation
  await storeDelegation(delegation);

  return delegation;
}
```

### 7.2 Agent Action Signing

```typescript
/**
 * Agent signs action with credential reference
 */
interface SignedAgentAction {
  /**
   * Action identifier
   */
  actionId: string;

  /**
   * Agent DID
   */
  agentDID: AgentDID;

  /**
   * Credential reference
   */
  credentialRef: {
    credentialId: CredentialId;
    credentialHash: HexString;
  };

  /**
   * Delegation reference (for viewing key actions)
   */
  delegationRef?: {
    delegationId: DelegationId;
    delegationHash: HexString;
  };

  /**
   * Action type
   */
  actionType: AgentActionType;

  /**
   * Action details
   */
  action: AgentAction;

  /**
   * Timestamp
   */
  timestamp: Timestamp;

  /**
   * Nonce (prevents replay)
   */
  nonce: string;

  /**
   * Agent signature
   */
  signature: Signature;
}

enum AgentActionType {
  VIEW_BALANCE = 'view_balance',
  VIEW_TRANSACTIONS = 'view_transactions',
  GENERATE_REPORT = 'generate_report',
  EXPORT_DATA = 'export_data',
  PROVE_BALANCE = 'prove_balance',
  SUBSCRIBE_UPDATES = 'subscribe_updates'
}

/**
 * Agent signs an action
 */
async function signAgentAction(
  agentKeyPair: KeyPair,
  credential: AgentCredential,
  action: AgentAction
): Promise<SignedAgentAction> {
  const actionId = generateActionId();
  const nonce = generateNonce();
  const timestamp = Math.floor(Date.now() / 1000);

  const signedAction: SignedAgentAction = {
    actionId,
    agentDID: credential.credentialSubject.id,
    credentialRef: {
      credentialId: credential.id,
      credentialHash: hashCredential(credential)
    },
    actionType: action.type,
    action,
    timestamp,
    nonce,
    signature: null! // Set below
  };

  // Create message to sign
  const message = createActionMessage(signedAction);

  // Sign with agent key
  signedAction.signature = await sign(message, agentKeyPair.privateKey);

  return signedAction;
}

/**
 * Verify signed agent action
 */
async function verifySignedAgentAction(
  signedAction: SignedAgentAction
): Promise<ActionVerificationResult> {
  // 1. Get credential
  const credential = await getCredential(signedAction.credentialRef.credentialId);
  if (!credential) {
    return { valid: false, reason: 'Credential not found' };
  }

  // 2. Verify credential hash matches
  const credentialHash = hashCredential(credential);
  if (credentialHash !== signedAction.credentialRef.credentialHash) {
    return { valid: false, reason: 'Credential hash mismatch' };
  }

  // 3. Verify credential is valid
  const credentialValid = await verifyAgentCredential(credential);
  if (!credentialValid.valid) {
    return { valid: false, reason: credentialValid.errors[0].message };
  }

  // 4. Verify agent DID matches credential
  if (signedAction.agentDID !== credential.credentialSubject.id) {
    return { valid: false, reason: 'Agent DID mismatch' };
  }

  // 5. Verify action is within permissions
  if (!isActionPermitted(signedAction.actionType, credential.credentialSubject.permissions)) {
    return { valid: false, reason: 'Action not permitted by credential' };
  }

  // 6. Verify signature
  const agentDoc = await resolveAgentDID(signedAction.agentDID);
  const agentPublicKey = agentDoc.verificationMethod[0].publicKeyHex;
  const message = createActionMessage(signedAction);
  const signatureValid = await verify(signedAction.signature, message, agentPublicKey);

  if (!signatureValid) {
    return { valid: false, reason: 'Invalid signature' };
  }

  // 7. Check nonce not reused
  const nonceUsed = await checkNonceUsed(signedAction.nonce);
  if (nonceUsed) {
    return { valid: false, reason: 'Nonce already used (replay attack)' };
  }

  // 8. Mark nonce as used
  await markNonceUsed(signedAction.nonce, signedAction.timestamp);

  return {
    valid: true,
    credential,
    principal: credential.credentialSubject.principal,
    verifiedAt: Date.now()
  };
}
```

---

## 8. Compliance Framework

### 8.1 Agent Activity Reporting

```typescript
/**
 * Agent activity report for compliance
 */
interface AgentActivityReport {
  /**
   * Report metadata
   */
  metadata: {
    reportId: string;
    agentDID: AgentDID;
    credentialId: CredentialId;
    principalDID: DID;
    period: DateRange;
    generatedAt: Timestamp;
  };

  /**
   * Activity summary
   */
  summary: {
    totalActions: number;
    actionsByType: Record<AgentActionType, number>;
    uniqueSessions: number;
    dataAccessed: DataAccessSummary;
  };

  /**
   * Individual actions (if requested)
   */
  actions?: SignedAgentAction[];

  /**
   * Anomalies detected
   */
  anomalies: AnomalyReport[];

  /**
   * Compliance status
   */
  compliance: {
    withinScope: boolean;
    permissionsRespected: boolean;
    noSuspiciousActivity: boolean;
    issues: ComplianceIssue[];
  };

  /**
   * Report signature (by reporting service)
   */
  signature: Signature;
}

/**
 * Generate agent activity report
 */
async function generateAgentActivityReport(
  agentDID: AgentDID,
  period: DateRange,
  options: ReportOptions
): Promise<AgentActivityReport> {
  // 1. Get credential
  const credential = await getActiveCredentialForAgent(agentDID);
  if (!credential) {
    throw new Error('No active credential for agent');
  }

  // 2. Get all actions in period
  const actions = await getAgentActions(agentDID, period);

  // 3. Summarize activity
  const summary = summarizeAgentActivity(actions);

  // 4. Check for anomalies
  const anomalies = await detectAnomalies(actions, credential);

  // 5. Check compliance
  const compliance = await checkCompliance(actions, credential);

  // 6. Build report
  const report: AgentActivityReport = {
    metadata: {
      reportId: generateReportId(),
      agentDID,
      credentialId: credential.id,
      principalDID: credential.issuer.id,
      period,
      generatedAt: Date.now()
    },
    summary,
    actions: options.includeActions ? actions : undefined,
    anomalies,
    compliance,
    signature: null!
  };

  // 7. Sign report
  report.signature = await signReport(report);

  return report;
}
```

### 8.2 Principal Accountability

```typescript
/**
 * Principal accountability report
 */
interface PrincipalAccountabilityReport {
  /**
   * Principal information
   */
  principal: {
    did: DID;
    name: string;
    type: PrincipalType;
    jurisdiction?: string;
  };

  /**
   * All agents under this principal
   */
  agents: {
    agentDID: AgentDID;
    credentialId: CredentialId;
    status: 'active' | 'expired' | 'revoked';
    activitySummary: ActivitySummary;
  }[];

  /**
   * Aggregate statistics
   */
  aggregate: {
    totalAgents: number;
    activeAgents: number;
    totalActions: number;
    totalDataAccessed: DataAccessSummary;
  };

  /**
   * Liability summary
   */
  liability: {
    model: LiabilityModel;
    exposureEstimate?: Money;
    insuranceCoverage?: Money;
  };

  /**
   * Period covered
   */
  period: DateRange;

  /**
   * Generated timestamp
   */
  generatedAt: Timestamp;
}
```

### 8.3 Regulatory Alignment

```typescript
/**
 * Regulatory framework alignment
 */
const REGULATORY_ALIGNMENT = {
  /**
   * GDPR (EU Data Protection)
   */
  gdpr: {
    dataController: 'Principal (as defined in credential)',
    dataProcessor: 'Agent (with viewing key access)',
    lawfulBasis: 'Legitimate interest / Contract',
    dataSubjectRights: {
      access: 'Via principal disclosure',
      erasure: 'Revoke credential + viewing key',
      portability: 'Export reports'
    }
  },

  /**
   * BSA/AML (US Anti-Money Laundering)
   */
  bsaAml: {
    cddResponsibility: 'Principal (human/org)',
    agentRole: 'Automated monitoring / reporting',
    sarFiling: 'Principal responsibility via agent',
    recordKeeping: 'Audit trail via signed actions'
  },

  /**
   * MiCA (EU Crypto Regulation)
   */
  mica: {
    cryptoAssetServiceProvider: 'Principal if applicable',
    agentAuthorization: 'Delegated via credential',
    marketAbusePrevention: 'Agent activity monitoring'
  },

  /**
   * SOX (US Corporate Governance)
   */
  sox: {
    internalControls: 'Credential scope limits',
    auditTrail: 'Signed agent actions',
    ceoResponsibility: 'Principal accountability'
  }
};
```

---

## 9. Security Considerations

### 9.1 Threat Model

| Threat | Description | Mitigation |
|--------|-------------|------------|
| Credential Theft | Attacker obtains agent credential | Credentials bound to agent key; useless without private key |
| Principal Impersonation | Attacker issues fake credentials | Verify principal signature, check revocation |
| Agent Compromise | Agent private key leaked | Revoke credential immediately; short expiration |
| Scope Escalation | Agent exceeds permissions | Cryptographic scope enforcement in viewing keys |
| Replay Attack | Reuse signed actions | Nonce + timestamp validation |
| Provider Impersonation | Fake provider attestation | Verify against known provider keys |
| Credential Forgery | Create fake credential | Cryptographic signature verification |

### 9.2 Security Best Practices

```typescript
/**
 * Security best practices for agent credentials
 */
const SECURITY_BEST_PRACTICES = {
  /**
   * Credential Expiration
   */
  expiration: {
    maxDuration: 365 * 24 * 60 * 60, // 1 year
    recommendedDuration: 90 * 24 * 60 * 60, // 90 days
    minDuration: 1 * 60 * 60 // 1 hour
  },

  /**
   * Key Management
   */
  keys: {
    keyRotationPeriod: 90 * 24 * 60 * 60, // 90 days
    keyStorageRequirement: 'HSM or secure enclave',
    backupKeyRequired: true
  },

  /**
   * Provider Attestation
   */
  attestation: {
    requiredForProduction: true,
    verifyProviderKeys: true,
    checkProviderStatus: true
  },

  /**
   * Action Signing
   */
  actions: {
    nonceRequired: true,
    timestampMaxAge: 300, // 5 minutes
    signAllActions: true
  },

  /**
   * Revocation
   */
  revocation: {
    checkBeforeEveryAction: true,
    revocationListCacheTTL: 60, // 1 minute
    supportEmergencyRevocation: true
  }
};
```

### 9.3 Emergency Procedures

```typescript
/**
 * Emergency credential revocation
 */
async function emergencyRevocation(
  credentialId: CredentialId,
  reason: string
): Promise<EmergencyRevocationResult> {
  // 1. Immediate revocation
  await revokeAgentCredential(
    credentialId,
    RevocationReason.AGENT_COMPROMISED,
    'emergency-system'
  );

  // 2. Revoke all associated viewing key delegations
  const delegations = await getDelegationsForCredential(credentialId);
  for (const delegation of delegations) {
    await revokeDelegation(delegation.id, 'Emergency: credential revoked');
  }

  // 3. Broadcast revocation to all known verifiers
  await broadcastEmergencyRevocation(credentialId);

  // 4. Notify principal
  const credential = await getCredential(credentialId);
  await notifyPrincipalOfEmergency(credential.issuer.id, {
    credentialId,
    reason,
    timestamp: Date.now()
  });

  // 5. Log incident
  await logSecurityIncident({
    type: 'emergency_revocation',
    credentialId,
    reason,
    timestamp: Date.now()
  });

  return {
    success: true,
    revocationsIssued: 1 + delegations.length,
    broadcastSent: true,
    principalNotified: true
  };
}
```

---

## 10. Registry Specification

### 10.1 Registry Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT CREDENTIAL REGISTRY                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              OFF-CHAIN LAYER                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Credential      │  │ Revocation      │  │ Provider        │              │
│  │ Storage         │  │ List            │  │ Registry        │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ Anchoring
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ON-CHAIN LAYER                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Credential      │  │ Revocation      │  │ Provider        │              │
│  │ Anchors         │  │ Merkle Root     │  │ Keys Registry   │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                             │
│  Chains: Solana, Ethereum, NEAR                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 On-Chain Registry Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AgentCredentialRegistry
 * @notice On-chain registry for agent credential anchoring and revocation
 */
interface IAgentCredentialRegistry {
    /**
     * @notice Credential anchored event
     */
    event CredentialAnchored(
        bytes32 indexed credentialHash,
        bytes32 indexed agentDIDHash,
        bytes32 indexed principalDIDHash,
        uint256 expiresAt
    );

    /**
     * @notice Credential revoked event
     */
    event CredentialRevoked(
        bytes32 indexed credentialHash,
        address indexed revokedBy,
        string reason,
        uint256 revokedAt
    );

    /**
     * @notice Anchor credential on-chain
     */
    function anchorCredential(
        bytes32 credentialHash,
        bytes32 agentDIDHash,
        bytes32 principalDIDHash,
        uint256 expiresAt,
        bytes calldata principalSignature
    ) external;

    /**
     * @notice Revoke credential
     */
    function revokeCredential(
        bytes32 credentialHash,
        string calldata reason
    ) external;

    /**
     * @notice Check if credential is valid
     */
    function isCredentialValid(bytes32 credentialHash)
        external
        view
        returns (bool valid, uint256 expiresAt, bool revoked);

    /**
     * @notice Update revocation Merkle root
     */
    function updateRevocationRoot(
        bytes32 newRoot,
        uint256 credentialsRevoked
    ) external;
}
```

### 10.3 Registry API

```typescript
/**
 * Agent Credential Registry API
 */
interface AgentCredentialRegistryAPI {
  /**
   * Register new credential
   */
  register(credential: AgentCredential): Promise<RegistrationResult>;

  /**
   * Get credential by ID
   */
  get(credentialId: CredentialId): Promise<AgentCredential | null>;

  /**
   * List credentials by agent
   */
  listByAgent(agentDID: AgentDID): Promise<AgentCredential[]>;

  /**
   * List credentials by principal
   */
  listByPrincipal(principalDID: DID): Promise<AgentCredential[]>;

  /**
   * Check revocation status
   */
  checkRevocation(credentialId: CredentialId): Promise<RevocationStatus>;

  /**
   * Revoke credential
   */
  revoke(
    credentialId: CredentialId,
    reason: RevocationReason,
    revokerSignature: Signature
  ): Promise<RevocationResult>;

  /**
   * Get revocation proof (Merkle proof)
   */
  getRevocationProof(credentialId: CredentialId): Promise<RevocationProof>;

  /**
   * Search credentials
   */
  search(query: CredentialSearchQuery): Promise<SearchResult>;
}
```

---

## 11. SDK Reference

### 11.1 TypeScript SDK

```typescript
import { AgentCredentialSDK } from '@sip-protocol/agent-credentials';

// Initialize SDK
const sdk = new AgentCredentialSDK({
  registryUrl: 'https://registry.sip-protocol.org',
  chain: 'solana'
});

// Issue credential to agent
const credential = await sdk.issueCredential({
  agentDID: 'did:agent:anthropic:claude-treasury-001',
  principalDID: 'did:key:z6Mk...',
  principalPrivateKey: principalKey,
  agentType: 'treasury_manager',
  permissions: [
    'view_balance',
    'view_transactions',
    'generate_reports'
  ],
  scope: {
    assets: ['SOL', 'USDC'],
    chains: ['solana'],
    maxTransactionValue: BigInt('100000000000')
  },
  principal: {
    type: 'dao',
    name: 'Acme DAO',
    liability: 'full',
    governanceContract: '0x...'
  },
  expirationDate: new Date('2026-12-31')
});

console.log('Credential issued:', credential.id);

// Verify credential
const verification = await sdk.verifyCredential(credential);
console.log('Valid:', verification.valid);

// Create viewing key delegation
const delegation = await sdk.createViewingKeyDelegation({
  credential,
  viewingKeyPair,
  permissions: ['view_balance', 'view_transactions'],
  scope: { assets: ['SOL'] },
  expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
});

// Agent signs action
const signedAction = await sdk.signAgentAction({
  agentKeyPair,
  credential,
  action: {
    type: 'view_balance',
    params: { asset: 'SOL' }
  }
});

// Verify signed action
const actionVerification = await sdk.verifySignedAction(signedAction);
console.log('Action valid:', actionVerification.valid);
console.log('Principal:', actionVerification.principal.name);

// Revoke credential
await sdk.revokeCredential({
  credentialId: credential.id,
  reason: 'principal_revoked',
  revokerDID: 'did:key:z6Mk...',
  revokerPrivateKey: principalKey
});
```

### 11.2 React Hooks

```tsx
import {
  useAgentCredential,
  useIssueCredential,
  useVerifyCredential,
  useRevokeCredential
} from '@sip-protocol/agent-credentials-react';

function AgentCredentialManager() {
  const { issueCredential, isPending } = useIssueCredential();
  const { revokeCredential } = useRevokeCredential();

  const handleIssue = async () => {
    const credential = await issueCredential({
      agentDID: 'did:agent:anthropic:claude-001',
      agentType: 'treasury_manager',
      permissions: ['view_balance'],
      expirationDate: new Date('2026-12-31')
    });
    console.log('Issued:', credential.id);
  };

  return (
    <div>
      <button onClick={handleIssue} disabled={isPending}>
        Issue Credential
      </button>
    </div>
  );
}

function CredentialVerifier({ credentialId }: { credentialId: string }) {
  const { credential, verification, isLoading } = useAgentCredential(credentialId);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h3>Credential: {credentialId}</h3>
      <p>Agent: {credential?.credentialSubject.id}</p>
      <p>Valid: {verification?.valid ? 'Yes' : 'No'}</p>
      <p>Principal: {credential?.credentialSubject.principal.name}</p>
    </div>
  );
}
```

### 11.3 CLI Commands

```bash
# Issue credential
sip agent-credential issue \
  --agent-did did:agent:anthropic:claude-001 \
  --agent-type treasury_manager \
  --permissions view_balance,view_transactions \
  --scope-assets SOL,USDC \
  --expires 2026-12-31 \
  --principal-name "Acme DAO" \
  --principal-type dao \
  --output credential.json

# Verify credential
sip agent-credential verify --credential credential.json

# Check revocation status
sip agent-credential status --id urn:uuid:3978344f-8596-4c3a-a978-8fcaba3903c5

# Revoke credential
sip agent-credential revoke \
  --id urn:uuid:3978344f-8596-4c3a-a978-8fcaba3903c5 \
  --reason principal_revoked

# Generate activity report
sip agent-credential report \
  --agent-did did:agent:anthropic:claude-001 \
  --start 2026-01-01 \
  --end 2026-03-31 \
  --output report.json

# List credentials for principal
sip agent-credential list \
  --principal-did did:key:z6Mk...
```

---

## 12. Test Vectors

### 12.1 Credential Issuance

```typescript
const testVector1 = {
  input: {
    agentDID: 'did:agent:test:agent-001',
    principalDID: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
    principalPrivateKey: '0x1234567890abcdef...',
    agentType: 'treasury_manager',
    permissions: ['view_balance'],
    expirationDate: '2026-12-31T23:59:59Z'
  },
  expected: {
    credentialType: ['VerifiableCredential', 'AgentCredential'],
    issuerMatch: true,
    signatureValid: true
  }
};
```

### 12.2 Credential Verification

```typescript
const testVector2 = {
  input: {
    credential: {/* valid credential */},
    currentTime: '2026-06-15T12:00:00Z'
  },
  expected: {
    valid: true,
    expired: false,
    revoked: false,
    signatureValid: true
  }
};

const testVector3 = {
  input: {
    credential: {/* expired credential */},
    currentTime: '2027-01-15T12:00:00Z'
  },
  expected: {
    valid: false,
    expired: true,
    errorCode: 'EXPIRED'
  }
};
```

### 12.3 Action Signing

```typescript
const testVector4 = {
  input: {
    agentPrivateKey: '0xabcdef...',
    credential: {/* valid credential */},
    action: {
      type: 'view_balance',
      params: { asset: 'SOL' }
    },
    nonce: 'unique-nonce-123',
    timestamp: 1705320000
  },
  expected: {
    signatureLength: 64, // bytes
    nonceIncluded: true,
    timestampIncluded: true
  }
};
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | January 2026 | Initial specification |

---

## References

1. [a16z Big Ideas 2026 - Know Your Agent](https://a16z.com/big-ideas-2026)
2. [W3C Decentralized Identifiers (DIDs)](https://www.w3.org/TR/did-core/)
3. [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
4. [SIP-003: Viewing Key Standard](./sip-eips/SIP-003-VIEWING-KEYS.md)
5. [Agent Viewing Key API](./AGENT-VIEWING-KEY-API.md)
6. [Time-Bound Delegation](./TIME-BOUND-DELEGATION.md)

---

**Document Version:** 1.0.0
**Last Updated:** January 2026
