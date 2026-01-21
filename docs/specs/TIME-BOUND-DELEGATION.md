# Time-Bound Viewing Key Delegation Specification

**Version:** 1.0.0
**Status:** Draft
**Created:** January 2026
**Authors:** SIP Protocol Team

---

## Abstract

This specification defines a time-bound viewing key delegation system for SIP Protocol. It enables viewing key holders to delegate limited, revocable access to third parties (auditors, compliance officers, agents) with fine-grained scope controls including time bounds, amount limits, and address patterns.

---

## Table of Contents

1. [Motivation](#motivation)
2. [Delegation Types](#delegation-types)
3. [Core Interfaces](#core-interfaces)
4. [Scope Limitations](#scope-limitations)
5. [Delegation Lifecycle](#delegation-lifecycle)
6. [Revocation Mechanism](#revocation-mechanism)
7. [On-Chain Registry](#on-chain-registry)
8. [Cryptographic Protocol](#cryptographic-protocol)
9. [Security Considerations](#security-considerations)
10. [SDK Integration](#sdk-integration)
11. [Test Vectors](#test-vectors)
12. [Reference Implementation](#reference-implementation)

---

## 1. Motivation

### Problem Statement

Current viewing key sharing is binary: either share full access or share nothing. This creates challenges:

1. **Audit Scope**: Auditors need access to specific time periods, not entire history
2. **Amount Sensitivity**: Some transactions should remain private even from auditors
3. **Temporal Access**: Access should expire automatically after audit completion
4. **Agent Automation**: AI agents need scoped access for specific operations
5. **Revocation**: Ability to revoke access if relationship ends

### Solution

Time-bound viewing key delegation provides:

- **Scoped Access**: Limit what delegatees can view
- **Time Bounds**: Automatic expiration of access
- **Amount Filters**: Hide transactions outside specified ranges
- **Revocation**: Immediate access termination
- **Auditability**: Track who accessed what and when

---

## 2. Delegation Types

### 2.1 Delegation Hierarchy

```
Full Viewing Key (Owner)
    │
    ├── Time-Bound Delegation (Auditor)
    │       └── Scoped to: 2025-01-01 to 2025-12-31
    │       └── Permissions: view_history, export_reports
    │
    ├── Amount-Scoped Delegation (Compliance)
    │       └── Scoped to: amounts > $10,000
    │       └── Permissions: view_history, prove_balance
    │
    └── Agent Delegation (Automated)
            └── Scoped to: specific addresses
            └── Permissions: view_history
            └── Expires: 24 hours
```

### 2.2 Delegation Type Definitions

```typescript
/**
 * Types of viewing key delegations
 */
enum DelegationType {
  /**
   * Full access within time bounds
   * Use case: Annual audits, tax reporting
   */
  TIME_BOUND = 'time_bound',

  /**
   * Access filtered by transaction amounts
   * Use case: Large transaction monitoring, compliance thresholds
   */
  AMOUNT_SCOPED = 'amount_scoped',

  /**
   * Access filtered by address patterns
   * Use case: Counterparty-specific audits
   */
  ADDRESS_SCOPED = 'address_scoped',

  /**
   * Combined time + amount + address scoping
   * Use case: Complex compliance requirements
   */
  COMPOSITE = 'composite',

  /**
   * Short-lived delegation for automated agents
   * Use case: AI agents, automated reporting
   */
  AGENT = 'agent',

  /**
   * One-time use delegation (invalidated after first use)
   * Use case: Single audit session, one-time verification
   */
  ONE_TIME = 'one_time'
}
```

---

## 3. Core Interfaces

### 3.1 ViewingKeyDelegation

```typescript
/**
 * Core delegation structure
 */
interface ViewingKeyDelegation {
  /**
   * Unique delegation identifier
   * Format: del_<random_32_bytes_hex>
   */
  id: DelegationId;

  /**
   * Version for forward compatibility
   */
  version: '1.0.0';

  /**
   * Address of the delegator (viewing key owner)
   */
  delegator: Address;

  /**
   * Address of the delegatee (recipient of access)
   */
  delegatee: Address;

  /**
   * Type of delegation
   */
  type: DelegationType;

  /**
   * When the delegation was created
   */
  createdAt: Timestamp;

  /**
   * When the delegation expires (required)
   */
  expiresAt: Timestamp;

  /**
   * Scope limitations for the delegation
   */
  scope: DelegationScope;

  /**
   * Permissions granted to delegatee
   */
  permissions: DelegationPermission[];

  /**
   * Current status of the delegation
   */
  status: DelegationStatus;

  /**
   * If revoked, revocation details
   */
  revocation?: RevocationInfo;

  /**
   * Encrypted derived viewing key for delegatee
   */
  encryptedViewingKey: EncryptedKey;

  /**
   * Signature from delegator authorizing this delegation
   */
  signature: Signature;

  /**
   * Optional on-chain registry reference
   */
  registryRef?: {
    chain: ChainId;
    txHash: HexString;
    registryAddress: Address;
  };
}

/**
 * Type aliases for clarity
 */
type DelegationId = `del_${string}`;
type Timestamp = number; // Unix timestamp in seconds
type Address = string;
type HexString = `0x${string}`;
type Signature = HexString;
type EncryptedKey = HexString;
type ChainId = string;
```

### 3.2 DelegationScope

```typescript
/**
 * Scope limitations for delegated access
 */
interface DelegationScope {
  /**
   * Time range for visible transactions
   * Transactions outside this range are invisible to delegatee
   */
  dateRange?: {
    /**
     * Start of visible period (inclusive)
     */
    start: Date;

    /**
     * End of visible period (inclusive)
     */
    end: Date;
  };

  /**
   * Minimum transaction amount to be visible
   * Transactions below this threshold are hidden
   * In base units (e.g., lamports, wei)
   */
  minAmount?: bigint;

  /**
   * Maximum transaction amount to be visible
   * Transactions above this threshold are hidden
   * In base units
   */
  maxAmount?: bigint;

  /**
   * Address patterns that are visible
   * Supports wildcards: 0x1234...* matches prefix
   * If specified, only matching addresses are visible
   */
  addressPatterns?: string[];

  /**
   * Specific addresses to include (allowlist)
   * Takes precedence over patterns
   */
  includeAddresses?: Address[];

  /**
   * Specific addresses to exclude (blocklist)
   * Takes precedence over include
   */
  excludeAddresses?: Address[];

  /**
   * Token/asset types visible
   * If specified, only these assets are visible
   */
  assetTypes?: AssetType[];

  /**
   * Transaction types visible
   * If specified, only these tx types are visible
   */
  transactionTypes?: TransactionType[];

  /**
   * Chain IDs where this delegation is valid
   * If empty, valid on all chains
   */
  chains?: ChainId[];

  /**
   * Custom metadata filters (extensible)
   */
  customFilters?: Record<string, unknown>;
}

/**
 * Supported asset types
 */
enum AssetType {
  NATIVE = 'native',        // SOL, ETH, etc.
  SPL_TOKEN = 'spl_token',  // Solana tokens
  ERC20 = 'erc20',          // EVM tokens
  NFT = 'nft',              // Non-fungible tokens
  ALL = 'all'               // No asset filtering
}

/**
 * Transaction types for filtering
 */
enum TransactionType {
  TRANSFER = 'transfer',
  SWAP = 'swap',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  BRIDGE = 'bridge',
  CONTRACT_CALL = 'contract_call',
  ALL = 'all'
}
```

### 3.3 DelegationPermission

```typescript
/**
 * Permissions that can be granted to delegatees
 */
enum DelegationPermission {
  /**
   * View transaction history within scope
   * Most common permission
   */
  VIEW_HISTORY = 'view_history',

  /**
   * Export reports (PDF, CSV, JSON)
   * Requires VIEW_HISTORY
   */
  EXPORT_REPORTS = 'export_reports',

  /**
   * Generate zero-knowledge balance proofs
   * Proves balance >= threshold without revealing exact amount
   */
  PROVE_BALANCE = 'prove_balance',

  /**
   * Prove transaction existence (audit attestation)
   * Proves a transaction occurred without revealing details
   */
  PROVE_TRANSACTION = 'prove_transaction',

  /**
   * Stream real-time transactions (within scope)
   * For continuous monitoring
   */
  STREAM_TRANSACTIONS = 'stream_transactions',

  /**
   * Access aggregated statistics only (no individual txs)
   * For privacy-preserving analytics
   */
  VIEW_STATISTICS = 'view_statistics',

  /**
   * Delegate to sub-delegatees (dangerous)
   * Enables delegation chains
   */
  SUB_DELEGATE = 'sub_delegate'
}

/**
 * Permission compatibility matrix
 */
const PERMISSION_REQUIREMENTS: Record<DelegationPermission, DelegationPermission[]> = {
  [DelegationPermission.VIEW_HISTORY]: [],
  [DelegationPermission.EXPORT_REPORTS]: [DelegationPermission.VIEW_HISTORY],
  [DelegationPermission.PROVE_BALANCE]: [],
  [DelegationPermission.PROVE_TRANSACTION]: [DelegationPermission.VIEW_HISTORY],
  [DelegationPermission.STREAM_TRANSACTIONS]: [DelegationPermission.VIEW_HISTORY],
  [DelegationPermission.VIEW_STATISTICS]: [],
  [DelegationPermission.SUB_DELEGATE]: [DelegationPermission.VIEW_HISTORY]
};
```

### 3.4 DelegationStatus

```typescript
/**
 * Delegation lifecycle status
 */
enum DelegationStatus {
  /**
   * Delegation created but not yet accepted by delegatee
   */
  PENDING = 'pending',

  /**
   * Delegation active and usable
   */
  ACTIVE = 'active',

  /**
   * Delegation expired (past expiresAt)
   */
  EXPIRED = 'expired',

  /**
   * Delegation revoked by delegator
   */
  REVOKED = 'revoked',

  /**
   * Delegation rejected by delegatee
   */
  REJECTED = 'rejected',

  /**
   * One-time delegation already used
   */
  CONSUMED = 'consumed',

  /**
   * Delegation suspended (temporary hold)
   */
  SUSPENDED = 'suspended'
}
```

---

## 4. Scope Limitations

### 4.1 Time-Based Scoping

```typescript
/**
 * Create a time-scoped delegation for annual audit
 */
function createAuditDelegation(
  delegator: ViewingKeyPair,
  auditorAddress: Address,
  fiscalYear: number
): ViewingKeyDelegation {
  const startOfYear = new Date(fiscalYear, 0, 1);
  const endOfYear = new Date(fiscalYear, 11, 31, 23, 59, 59);

  return {
    id: generateDelegationId(),
    version: '1.0.0',
    delegator: delegator.address,
    delegatee: auditorAddress,
    type: DelegationType.TIME_BOUND,
    createdAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(endOfYear.getTime() / 1000) + 90 * 24 * 60 * 60, // 90 days after year end
    scope: {
      dateRange: {
        start: startOfYear,
        end: endOfYear
      }
    },
    permissions: [
      DelegationPermission.VIEW_HISTORY,
      DelegationPermission.EXPORT_REPORTS
    ],
    status: DelegationStatus.PENDING,
    encryptedViewingKey: deriveAndEncryptScopedKey(delegator, auditorAddress),
    signature: signDelegation(delegator, /* delegation data */)
  };
}
```

### 4.2 Amount-Based Scoping

```typescript
/**
 * Create amount-scoped delegation for large transaction monitoring
 * Only transactions above threshold are visible
 */
function createLargeTransactionDelegation(
  delegator: ViewingKeyPair,
  complianceAddress: Address,
  thresholdUSD: number
): ViewingKeyDelegation {
  // Convert USD to base units (assuming $1 = 1e6 micro-units)
  const thresholdBaseUnits = BigInt(thresholdUSD * 1e6);

  return {
    id: generateDelegationId(),
    version: '1.0.0',
    delegator: delegator.address,
    delegatee: complianceAddress,
    type: DelegationType.AMOUNT_SCOPED,
    createdAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
    scope: {
      minAmount: thresholdBaseUnits
      // No maxAmount = unlimited upper bound
    },
    permissions: [
      DelegationPermission.VIEW_HISTORY,
      DelegationPermission.PROVE_TRANSACTION
    ],
    status: DelegationStatus.PENDING,
    encryptedViewingKey: deriveAndEncryptScopedKey(delegator, complianceAddress),
    signature: signDelegation(delegator, /* delegation data */)
  };
}
```

### 4.3 Address Pattern Scoping

```typescript
/**
 * Create address-scoped delegation for counterparty audit
 * Only transactions with specific counterparties visible
 */
function createCounterpartyDelegation(
  delegator: ViewingKeyPair,
  auditorAddress: Address,
  counterparties: Address[]
): ViewingKeyDelegation {
  return {
    id: generateDelegationId(),
    version: '1.0.0',
    delegator: delegator.address,
    delegatee: auditorAddress,
    type: DelegationType.ADDRESS_SCOPED,
    createdAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
    scope: {
      includeAddresses: counterparties,
      excludeAddresses: [] // Optionally exclude specific addresses
    },
    permissions: [
      DelegationPermission.VIEW_HISTORY,
      DelegationPermission.EXPORT_REPORTS
    ],
    status: DelegationStatus.PENDING,
    encryptedViewingKey: deriveAndEncryptScopedKey(delegator, auditorAddress),
    signature: signDelegation(delegator, /* delegation data */)
  };
}
```

### 4.4 Composite Scoping

```typescript
/**
 * Create composite delegation with multiple scope dimensions
 * Most flexible but most complex
 */
function createCompositeDelegation(
  delegator: ViewingKeyPair,
  delegateeAddress: Address,
  options: {
    dateRange?: { start: Date; end: Date };
    minAmount?: bigint;
    maxAmount?: bigint;
    includeAddresses?: Address[];
    excludeAddresses?: Address[];
    assetTypes?: AssetType[];
    transactionTypes?: TransactionType[];
    chains?: ChainId[];
  }
): ViewingKeyDelegation {
  return {
    id: generateDelegationId(),
    version: '1.0.0',
    delegator: delegator.address,
    delegatee: delegateeAddress,
    type: DelegationType.COMPOSITE,
    createdAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
    scope: {
      dateRange: options.dateRange,
      minAmount: options.minAmount,
      maxAmount: options.maxAmount,
      includeAddresses: options.includeAddresses,
      excludeAddresses: options.excludeAddresses,
      assetTypes: options.assetTypes,
      transactionTypes: options.transactionTypes,
      chains: options.chains
    },
    permissions: [
      DelegationPermission.VIEW_HISTORY,
      DelegationPermission.EXPORT_REPORTS,
      DelegationPermission.PROVE_BALANCE
    ],
    status: DelegationStatus.PENDING,
    encryptedViewingKey: deriveAndEncryptScopedKey(delegator, delegateeAddress),
    signature: signDelegation(delegator, /* delegation data */)
  };
}
```

---

## 5. Delegation Lifecycle

### 5.1 State Machine

```
                    ┌───────────┐
                    │  PENDING  │
                    └─────┬─────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
            ▼             ▼             ▼
      ┌──────────┐  ┌──────────┐  ┌──────────┐
      │ REJECTED │  │  ACTIVE  │  │ (timeout)│
      └──────────┘  └────┬─────┘  └────┬─────┘
                         │             │
         ┌───────────────┼─────────────┤
         │               │             │
         ▼               ▼             ▼
   ┌──────────┐    ┌──────────┐  ┌──────────┐
   │ SUSPENDED│◄──►│  ACTIVE  │  │ EXPIRED  │
   └──────────┘    └────┬─────┘  └──────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ REVOKED  │   │ EXPIRED  │   │ CONSUMED │
   └──────────┘   └──────────┘   └──────────┘
                                (one-time only)
```

### 5.2 Lifecycle Events

```typescript
/**
 * Delegation lifecycle event types
 */
enum DelegationEvent {
  CREATED = 'delegation.created',
  ACCEPTED = 'delegation.accepted',
  REJECTED = 'delegation.rejected',
  ACTIVATED = 'delegation.activated',
  SUSPENDED = 'delegation.suspended',
  RESUMED = 'delegation.resumed',
  REVOKED = 'delegation.revoked',
  EXPIRED = 'delegation.expired',
  CONSUMED = 'delegation.consumed',
  ACCESSED = 'delegation.accessed' // Each time delegatee uses delegation
}

/**
 * Event payload for delegation events
 */
interface DelegationEventPayload {
  event: DelegationEvent;
  delegationId: DelegationId;
  timestamp: Timestamp;
  actor: Address; // Who triggered the event
  details?: {
    reason?: string;
    metadata?: Record<string, unknown>;
  };
}
```

### 5.3 Lifecycle Operations

```typescript
/**
 * Delegation manager interface
 */
interface DelegationManager {
  /**
   * Create a new delegation
   */
  create(params: CreateDelegationParams): Promise<ViewingKeyDelegation>;

  /**
   * Accept a pending delegation (delegatee action)
   */
  accept(delegationId: DelegationId, delegateeSignature: Signature): Promise<void>;

  /**
   * Reject a pending delegation (delegatee action)
   */
  reject(delegationId: DelegationId, reason?: string): Promise<void>;

  /**
   * Suspend an active delegation temporarily
   */
  suspend(delegationId: DelegationId, reason: string): Promise<void>;

  /**
   * Resume a suspended delegation
   */
  resume(delegationId: DelegationId): Promise<void>;

  /**
   * Revoke a delegation immediately
   */
  revoke(delegationId: DelegationId, reason: string): Promise<void>;

  /**
   * Get delegation by ID
   */
  get(delegationId: DelegationId): Promise<ViewingKeyDelegation | null>;

  /**
   * List delegations by delegator
   */
  listByDelegator(address: Address): Promise<ViewingKeyDelegation[]>;

  /**
   * List delegations by delegatee
   */
  listByDelegatee(address: Address): Promise<ViewingKeyDelegation[]>;

  /**
   * Check if delegation is valid (not expired, not revoked, etc.)
   */
  validate(delegationId: DelegationId): Promise<ValidationResult>;

  /**
   * Use delegation to access data (records access, checks one-time)
   */
  use(delegationId: DelegationId, operation: string): Promise<UseResult>;
}
```

---

## 6. Revocation Mechanism

### 6.1 Revocation Types

```typescript
/**
 * Types of revocation
 */
enum RevocationType {
  /**
   * Immediate revocation - access ends now
   */
  IMMEDIATE = 'immediate',

  /**
   * Graceful revocation - access ends after grace period
   */
  GRACEFUL = 'graceful',

  /**
   * Scheduled revocation - access ends at specified time
   */
  SCHEDULED = 'scheduled',

  /**
   * Emergency revocation - broadcast to all systems immediately
   */
  EMERGENCY = 'emergency'
}

/**
 * Revocation information
 */
interface RevocationInfo {
  /**
   * When revocation was initiated
   */
  initiatedAt: Timestamp;

  /**
   * When revocation takes effect
   */
  effectiveAt: Timestamp;

  /**
   * Type of revocation
   */
  type: RevocationType;

  /**
   * Reason for revocation
   */
  reason: string;

  /**
   * Who initiated revocation
   */
  initiatedBy: Address;

  /**
   * On-chain revocation proof (if registered)
   */
  onChainProof?: {
    chain: ChainId;
    txHash: HexString;
    blockNumber: number;
  };
}
```

### 6.2 Revocation Process

```typescript
/**
 * Revoke a delegation
 */
async function revokeDelegation(
  delegator: ViewingKeyPair,
  delegationId: DelegationId,
  options: {
    type: RevocationType;
    reason: string;
    gracePeriodSeconds?: number;
    scheduledTime?: Timestamp;
  }
): Promise<RevocationResult> {
  // 1. Validate delegator owns this delegation
  const delegation = await getDelegation(delegationId);
  if (delegation.delegator !== delegator.address) {
    throw new Error('Only delegator can revoke');
  }

  // 2. Determine effective time
  let effectiveAt: Timestamp;
  switch (options.type) {
    case RevocationType.IMMEDIATE:
    case RevocationType.EMERGENCY:
      effectiveAt = Math.floor(Date.now() / 1000);
      break;
    case RevocationType.GRACEFUL:
      effectiveAt = Math.floor(Date.now() / 1000) + (options.gracePeriodSeconds || 86400);
      break;
    case RevocationType.SCHEDULED:
      effectiveAt = options.scheduledTime!;
      break;
  }

  // 3. Create revocation record
  const revocation: RevocationInfo = {
    initiatedAt: Math.floor(Date.now() / 1000),
    effectiveAt,
    type: options.type,
    reason: options.reason,
    initiatedBy: delegator.address
  };

  // 4. Update delegation status
  await updateDelegation(delegationId, {
    status: DelegationStatus.REVOKED,
    revocation
  });

  // 5. If on-chain registry, post revocation
  if (delegation.registryRef) {
    const txHash = await postOnChainRevocation(
      delegation.registryRef.chain,
      delegation.registryRef.registryAddress,
      delegationId,
      revocation
    );
    revocation.onChainProof = {
      chain: delegation.registryRef.chain,
      txHash,
      blockNumber: await getBlockNumber(delegation.registryRef.chain)
    };
  }

  // 6. Emit revocation event
  await emitEvent({
    event: DelegationEvent.REVOKED,
    delegationId,
    timestamp: revocation.initiatedAt,
    actor: delegator.address,
    details: { reason: options.reason }
  });

  // 7. For emergency revocations, broadcast to all known systems
  if (options.type === RevocationType.EMERGENCY) {
    await broadcastEmergencyRevocation(delegationId, revocation);
  }

  return {
    success: true,
    revocation,
    delegation: await getDelegation(delegationId)
  };
}
```

### 6.3 Revocation Verification

```typescript
/**
 * Verify a delegation is not revoked
 * Called by delegatee before using delegation
 */
async function verifyDelegationValid(
  delegationId: DelegationId
): Promise<ValidationResult> {
  const delegation = await getDelegation(delegationId);

  // Check status
  if (delegation.status === DelegationStatus.REVOKED) {
    return {
      valid: false,
      reason: 'Delegation has been revoked',
      revocation: delegation.revocation
    };
  }

  // Check expiry
  if (delegation.expiresAt < Math.floor(Date.now() / 1000)) {
    return {
      valid: false,
      reason: 'Delegation has expired'
    };
  }

  // Check on-chain revocation list (if applicable)
  if (delegation.registryRef) {
    const onChainStatus = await checkOnChainRevocationList(
      delegation.registryRef.chain,
      delegation.registryRef.registryAddress,
      delegationId
    );
    if (onChainStatus.revoked) {
      return {
        valid: false,
        reason: 'Delegation revoked on-chain',
        onChainProof: onChainStatus.proof
      };
    }
  }

  // Check if one-time and already consumed
  if (delegation.type === DelegationType.ONE_TIME &&
      delegation.status === DelegationStatus.CONSUMED) {
    return {
      valid: false,
      reason: 'One-time delegation already used'
    };
  }

  return { valid: true };
}
```

---

## 7. On-Chain Registry

### 7.1 Registry Contract Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SIPDelegationRegistry
 * @notice On-chain registry for viewing key delegations
 * @dev Optional - delegations can work off-chain only
 */
interface ISIPDelegationRegistry {
    /**
     * @notice Delegation registered event
     */
    event DelegationRegistered(
        bytes32 indexed delegationId,
        address indexed delegator,
        address indexed delegatee,
        uint256 expiresAt,
        bytes32 scopeHash
    );

    /**
     * @notice Delegation revoked event
     */
    event DelegationRevoked(
        bytes32 indexed delegationId,
        address indexed revokedBy,
        uint256 revokedAt,
        string reason
    );

    /**
     * @notice Register a new delegation
     * @param delegationId Unique identifier
     * @param delegatee Recipient of delegation
     * @param expiresAt Expiration timestamp
     * @param scopeHash Hash of scope parameters
     * @param signature Delegator signature
     */
    function register(
        bytes32 delegationId,
        address delegatee,
        uint256 expiresAt,
        bytes32 scopeHash,
        bytes calldata signature
    ) external;

    /**
     * @notice Revoke a delegation
     * @param delegationId Delegation to revoke
     * @param reason Revocation reason
     */
    function revoke(bytes32 delegationId, string calldata reason) external;

    /**
     * @notice Check if delegation is valid
     * @param delegationId Delegation to check
     * @return valid True if delegation is valid
     * @return expiry Expiration timestamp (0 if invalid)
     */
    function isValid(bytes32 delegationId)
        external
        view
        returns (bool valid, uint256 expiry);

    /**
     * @notice Get delegation details
     * @param delegationId Delegation to query
     */
    function getDelegation(bytes32 delegationId)
        external
        view
        returns (
            address delegator,
            address delegatee,
            uint256 expiresAt,
            bytes32 scopeHash,
            bool revoked,
            uint256 revokedAt
        );

    /**
     * @notice List all delegations for a delegator
     * @param delegator Address to query
     */
    function getDelegationsByDelegator(address delegator)
        external
        view
        returns (bytes32[] memory);

    /**
     * @notice List all delegations for a delegatee
     * @param delegatee Address to query
     */
    function getDelegationsByDelegatee(address delegatee)
        external
        view
        returns (bytes32[] memory);
}
```

### 7.2 Solana Program Interface

```rust
use anchor_lang::prelude::*;

/// Delegation registry program for Solana
#[program]
pub mod sip_delegation_registry {
    use super::*;

    /// Register a new delegation
    pub fn register_delegation(
        ctx: Context<RegisterDelegation>,
        delegation_id: [u8; 32],
        expires_at: i64,
        scope_hash: [u8; 32],
    ) -> Result<()> {
        let delegation = &mut ctx.accounts.delegation;
        delegation.id = delegation_id;
        delegation.delegator = ctx.accounts.delegator.key();
        delegation.delegatee = ctx.accounts.delegatee.key();
        delegation.expires_at = expires_at;
        delegation.scope_hash = scope_hash;
        delegation.created_at = Clock::get()?.unix_timestamp;
        delegation.revoked = false;
        delegation.revoked_at = 0;

        emit!(DelegationRegistered {
            delegation_id,
            delegator: delegation.delegator,
            delegatee: delegation.delegatee,
            expires_at,
        });

        Ok(())
    }

    /// Revoke a delegation
    pub fn revoke_delegation(
        ctx: Context<RevokeDelegation>,
        reason: String,
    ) -> Result<()> {
        require!(
            ctx.accounts.delegation.delegator == ctx.accounts.delegator.key(),
            DelegationError::NotDelegator
        );
        require!(
            !ctx.accounts.delegation.revoked,
            DelegationError::AlreadyRevoked
        );

        let delegation = &mut ctx.accounts.delegation;
        delegation.revoked = true;
        delegation.revoked_at = Clock::get()?.unix_timestamp;

        emit!(DelegationRevoked {
            delegation_id: delegation.id,
            revoked_by: ctx.accounts.delegator.key(),
            revoked_at: delegation.revoked_at,
            reason,
        });

        Ok(())
    }

    /// Check if delegation is valid
    pub fn is_valid(ctx: Context<CheckDelegation>) -> Result<bool> {
        let delegation = &ctx.accounts.delegation;
        let now = Clock::get()?.unix_timestamp;

        Ok(!delegation.revoked && delegation.expires_at > now)
    }
}

/// Delegation account structure
#[account]
pub struct Delegation {
    pub id: [u8; 32],
    pub delegator: Pubkey,
    pub delegatee: Pubkey,
    pub expires_at: i64,
    pub scope_hash: [u8; 32],
    pub created_at: i64,
    pub revoked: bool,
    pub revoked_at: i64,
}

/// Events
#[event]
pub struct DelegationRegistered {
    pub delegation_id: [u8; 32],
    pub delegator: Pubkey,
    pub delegatee: Pubkey,
    pub expires_at: i64,
}

#[event]
pub struct DelegationRevoked {
    pub delegation_id: [u8; 32],
    pub revoked_by: Pubkey,
    pub revoked_at: i64,
    pub reason: String,
}
```

### 7.3 Registry Usage

```typescript
/**
 * Register delegation on-chain for verifiable revocation
 */
async function registerOnChain(
  delegation: ViewingKeyDelegation,
  chain: ChainId
): Promise<RegistryResult> {
  const scopeHash = hashScope(delegation.scope);

  switch (chain) {
    case 'solana':
      return await registerSolana(delegation, scopeHash);
    case 'ethereum':
      return await registerEthereum(delegation, scopeHash);
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

/**
 * Check delegation validity across all registries
 */
async function checkAllRegistries(
  delegationId: DelegationId,
  chains: ChainId[]
): Promise<MultiChainValidityResult> {
  const results = await Promise.all(
    chains.map(async (chain) => ({
      chain,
      result: await checkOnChainValidity(delegationId, chain)
    }))
  );

  // If revoked on ANY chain, consider revoked
  const revoked = results.some(r => r.result.revoked);

  return {
    valid: !revoked,
    results,
    revokedOn: results.filter(r => r.result.revoked).map(r => r.chain)
  };
}
```

---

## 8. Cryptographic Protocol

### 8.1 Scoped Key Derivation

Delegated viewing keys are cryptographically derived from the master viewing key with scope parameters baked in. This ensures delegatees cannot access data outside their scope even if they try to bypass application-level checks.

```typescript
/**
 * Derive a scoped viewing key for delegation
 * The derived key can ONLY decrypt transactions within scope
 */
function deriveScopedViewingKey(
  masterViewingKey: ViewingKeyPair,
  scope: DelegationScope,
  delegatee: Address
): DerivedViewingKey {
  // 1. Serialize scope to deterministic bytes
  const scopeBytes = serializeScope(scope);

  // 2. Create scope commitment
  const scopeCommitment = sha256(scopeBytes);

  // 3. Derive scope-specific key using HKDF
  const derivedPrivateKey = hkdf({
    ikm: masterViewingKey.privateKey,
    salt: scopeCommitment,
    info: utf8ToBytes(`sip-delegation:${delegatee}`),
    length: 32
  });

  // 4. Compute public key
  const derivedPublicKey = secp256k1.getPublicKey(derivedPrivateKey);

  return {
    privateKey: bytesToHex(derivedPrivateKey),
    publicKey: bytesToHex(derivedPublicKey),
    scopeCommitment: bytesToHex(scopeCommitment),
    scope
  };
}

/**
 * Serialize scope for deterministic hashing
 */
function serializeScope(scope: DelegationScope): Uint8Array {
  // Canonical JSON serialization with sorted keys
  const canonical = JSON.stringify(scope, Object.keys(scope).sort());
  return utf8ToBytes(canonical);
}
```

### 8.2 Scope-Based Decryption

```typescript
/**
 * Attempt to decrypt transaction with scoped viewing key
 * Will fail if transaction is outside delegation scope
 */
async function decryptWithScopedKey(
  encryptedTx: EncryptedTransaction,
  scopedKey: DerivedViewingKey
): Promise<DecryptedTransaction | null> {
  // 1. Attempt standard decryption
  const decrypted = await decrypt(encryptedTx, scopedKey.privateKey);

  if (!decrypted) {
    // Key cannot decrypt - transaction outside scope
    return null;
  }

  // 2. Verify transaction is within scope
  // This is cryptographically enforced by key derivation
  // but we double-check at application level
  if (!isWithinScope(decrypted, scopedKey.scope)) {
    throw new Error('Scope violation: transaction outside delegation scope');
  }

  return decrypted;
}

/**
 * Check if transaction falls within scope
 */
function isWithinScope(
  tx: DecryptedTransaction,
  scope: DelegationScope
): boolean {
  // Check date range
  if (scope.dateRange) {
    const txDate = new Date(tx.timestamp * 1000);
    if (txDate < scope.dateRange.start || txDate > scope.dateRange.end) {
      return false;
    }
  }

  // Check amount range
  if (scope.minAmount !== undefined && tx.amount < scope.minAmount) {
    return false;
  }
  if (scope.maxAmount !== undefined && tx.amount > scope.maxAmount) {
    return false;
  }

  // Check address patterns
  if (scope.includeAddresses?.length) {
    const matches = scope.includeAddresses.some(
      addr => tx.sender === addr || tx.recipient === addr
    );
    if (!matches) return false;
  }

  if (scope.excludeAddresses?.length) {
    const excluded = scope.excludeAddresses.some(
      addr => tx.sender === addr || tx.recipient === addr
    );
    if (excluded) return false;
  }

  // Check address patterns (wildcards)
  if (scope.addressPatterns?.length) {
    const matches = scope.addressPatterns.some(pattern =>
      matchesPattern(tx.sender, pattern) ||
      matchesPattern(tx.recipient, pattern)
    );
    if (!matches) return false;
  }

  // Check asset types
  if (scope.assetTypes?.length && !scope.assetTypes.includes(AssetType.ALL)) {
    if (!scope.assetTypes.includes(tx.assetType)) {
      return false;
    }
  }

  // Check transaction types
  if (scope.transactionTypes?.length &&
      !scope.transactionTypes.includes(TransactionType.ALL)) {
    if (!scope.transactionTypes.includes(tx.type)) {
      return false;
    }
  }

  // Check chains
  if (scope.chains?.length && !scope.chains.includes(tx.chain)) {
    return false;
  }

  return true;
}
```

### 8.3 Delegation Signature

```typescript
/**
 * Sign a delegation for authenticity
 */
function signDelegation(
  delegator: ViewingKeyPair,
  delegation: Omit<ViewingKeyDelegation, 'signature'>
): Signature {
  // 1. Create canonical message
  const message = createDelegationMessage(delegation);

  // 2. Hash message
  const messageHash = sha256(message);

  // 3. Sign with delegator's spending key (not viewing key)
  // This proves ownership of the underlying account
  const signature = secp256k1.sign(messageHash, delegator.spendingPrivateKey);

  return `0x${signature.toCompactHex()}`;
}

/**
 * Verify delegation signature
 */
function verifyDelegationSignature(
  delegation: ViewingKeyDelegation,
  expectedDelegator: PublicKey
): boolean {
  // 1. Recreate message
  const message = createDelegationMessage({
    ...delegation,
    signature: undefined
  });

  // 2. Hash message
  const messageHash = sha256(message);

  // 3. Verify signature
  return secp256k1.verify(
    delegation.signature.slice(2), // Remove 0x prefix
    messageHash,
    expectedDelegator
  );
}

/**
 * Create canonical message for signing
 */
function createDelegationMessage(
  delegation: Omit<ViewingKeyDelegation, 'signature'>
): Uint8Array {
  const domain = 'SIP Delegation v1';
  const fields = [
    delegation.id,
    delegation.delegator,
    delegation.delegatee,
    delegation.type,
    delegation.createdAt.toString(),
    delegation.expiresAt.toString(),
    JSON.stringify(delegation.scope, Object.keys(delegation.scope || {}).sort()),
    delegation.permissions.sort().join(',')
  ];

  return utf8ToBytes(`${domain}\n${fields.join('\n')}`);
}
```

---

## 9. Security Considerations

### 9.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Delegatee exceeds scope | Cryptographic scope enforcement via derived keys |
| Replay attack | Unique delegation IDs, timestamps, signatures |
| Delegation theft | Encrypted transmission, delegatee verification |
| Revocation bypass | On-chain registry, emergency broadcast |
| Scope manipulation | Scope hash included in signature |
| Time manipulation | Use block timestamps for on-chain, NTP for off-chain |
| Key leakage | Derived keys limited to scope, can't derive master |

### 9.2 Best Practices

```typescript
/**
 * Security best practices for delegations
 */
const DELEGATION_BEST_PRACTICES = {
  // Maximum delegation duration
  MAX_DURATION_SECONDS: 365 * 24 * 60 * 60, // 1 year

  // Minimum duration (prevent instant expiry attacks)
  MIN_DURATION_SECONDS: 60, // 1 minute

  // Grace period before delegation takes effect
  ACTIVATION_DELAY_SECONDS: 0, // Can be increased for security

  // Maximum number of active delegations per delegator
  MAX_ACTIVE_DELEGATIONS: 100,

  // Require on-chain registration for delegations over this duration
  REQUIRE_ONCHAIN_AFTER_DAYS: 90,

  // Permissions that require explicit consent
  SENSITIVE_PERMISSIONS: [
    DelegationPermission.SUB_DELEGATE,
    DelegationPermission.STREAM_TRANSACTIONS
  ],

  // Permissions not allowed for agent delegations
  AGENT_FORBIDDEN_PERMISSIONS: [
    DelegationPermission.SUB_DELEGATE,
    DelegationPermission.EXPORT_REPORTS
  ]
};
```

### 9.3 Audit Trail

```typescript
/**
 * Audit log entry for delegation access
 */
interface DelegationAccessLog {
  /**
   * Unique log entry ID
   */
  id: string;

  /**
   * Delegation that was used
   */
  delegationId: DelegationId;

  /**
   * Who accessed
   */
  accessor: Address;

  /**
   * What was accessed
   */
  operation: string;

  /**
   * When accessed
   */
  timestamp: Timestamp;

  /**
   * IP address (if available)
   */
  ipAddress?: string;

  /**
   * User agent (if available)
   */
  userAgent?: string;

  /**
   * Number of transactions viewed
   */
  transactionsViewed?: number;

  /**
   * Hash of accessed data (for verification)
   */
  dataHash?: HexString;
}

/**
 * Log delegation access for audit purposes
 */
async function logDelegationAccess(
  delegation: ViewingKeyDelegation,
  operation: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const logEntry: DelegationAccessLog = {
    id: generateLogId(),
    delegationId: delegation.id,
    accessor: delegation.delegatee,
    operation,
    timestamp: Math.floor(Date.now() / 1000),
    ...metadata
  };

  // Store in audit log (append-only)
  await appendAuditLog(logEntry);

  // If operation involves viewing transactions, increment counter
  if (operation.startsWith('view_')) {
    await incrementAccessCounter(delegation.id);
  }
}
```

---

## 10. SDK Integration

### 10.1 TypeScript SDK

```typescript
import { SIP, ViewingKeyPair } from '@sip-protocol/sdk';

// Initialize SIP client
const sip = new SIP({ chain: 'solana' });

// Create a time-bound delegation for auditor
const delegation = await sip.delegations.create({
  delegatee: 'auditor-address',
  type: 'time_bound',
  expiresAt: new Date('2026-12-31'),
  scope: {
    dateRange: {
      start: new Date('2025-01-01'),
      end: new Date('2025-12-31')
    }
  },
  permissions: ['view_history', 'export_reports']
});

console.log('Delegation created:', delegation.id);

// Delegatee accepts the delegation
await sip.delegations.accept(delegation.id);

// Use delegation to view transactions
const transactions = await sip.delegations.useToViewHistory(
  delegation.id,
  { limit: 100 }
);

// Export report using delegation
const report = await sip.delegations.useToExportReport(
  delegation.id,
  { format: 'pdf' }
);

// Revoke delegation
await sip.delegations.revoke(delegation.id, {
  type: 'immediate',
  reason: 'Audit completed'
});
```

### 10.2 React Hooks

```tsx
import {
  useDelegations,
  useCreateDelegation,
  useRevokeDelegation
} from '@sip-protocol/react';

function DelegationManager() {
  // List delegations
  const { delegations, isLoading } = useDelegations();

  // Create delegation hook
  const { createDelegation, isPending } = useCreateDelegation();

  // Revoke delegation hook
  const { revokeDelegation } = useRevokeDelegation();

  const handleCreateAuditDelegation = async () => {
    await createDelegation({
      delegatee: auditorAddress,
      type: 'time_bound',
      expiresAt: new Date('2026-12-31'),
      scope: {
        dateRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-12-31')
        }
      },
      permissions: ['view_history', 'export_reports']
    });
  };

  const handleRevoke = async (delegationId: string) => {
    await revokeDelegation(delegationId, {
      type: 'immediate',
      reason: 'User requested'
    });
  };

  return (
    <div>
      <h2>My Delegations</h2>
      {delegations.map(d => (
        <DelegationCard
          key={d.id}
          delegation={d}
          onRevoke={() => handleRevoke(d.id)}
        />
      ))}
      <button onClick={handleCreateAuditDelegation}>
        Create Audit Delegation
      </button>
    </div>
  );
}
```

### 10.3 CLI Usage

```bash
# Create a delegation
sip delegation create \
  --delegatee 0x1234...5678 \
  --type time_bound \
  --expires 2026-12-31 \
  --scope-start 2025-01-01 \
  --scope-end 2025-12-31 \
  --permissions view_history,export_reports

# List delegations
sip delegation list

# Get delegation details
sip delegation get del_abc123

# Revoke a delegation
sip delegation revoke del_abc123 --reason "Audit completed"

# Check delegation validity
sip delegation validate del_abc123

# Use delegation to export report
sip delegation export del_abc123 --format pdf --output audit-2025.pdf
```

---

## 11. Test Vectors

### 11.1 Delegation Creation

```typescript
// Test vector 1: Time-bound delegation
const testVector1 = {
  input: {
    delegator: '0x0102030405060708091011121314151617181920212223242526272829303132',
    delegatee: '0x3132333435363738394041424344454647484950515253545556575859606162',
    scope: {
      dateRange: {
        start: new Date('2025-01-01T00:00:00Z'),
        end: new Date('2025-12-31T23:59:59Z')
      }
    },
    expiresAt: 1767225599, // 2025-12-31T23:59:59Z
    permissions: ['view_history', 'export_reports']
  },
  expected: {
    scopeHash: '0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
    derivedKeyPrefix: '0x02', // Compressed public key prefix
  }
};

// Test vector 2: Amount-scoped delegation
const testVector2 = {
  input: {
    delegator: '0x0102030405060708091011121314151617181920212223242526272829303132',
    delegatee: '0x3132333435363738394041424344454647484950515253545556575859606162',
    scope: {
      minAmount: BigInt('10000000000'), // 10,000 base units
      maxAmount: BigInt('1000000000000') // 1,000,000 base units
    },
    expiresAt: 1767225599,
    permissions: ['view_history']
  },
  expected: {
    scopeHash: '0x8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c'
  }
};
```

### 11.2 Revocation Verification

```typescript
// Test vector: Revocation
const revocationTestVector = {
  input: {
    delegationId: 'del_0102030405060708091011121314151617181920212223242526272829303132',
    revokedAt: 1704067200, // 2024-01-01T00:00:00Z
    reason: 'Relationship terminated'
  },
  expected: {
    revocationHash: '0x9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d',
    status: 'revoked'
  }
};
```

---

## 12. Reference Implementation

### 12.1 Core Classes

```typescript
// packages/sdk/src/delegation/manager.ts

import { sha256 } from '@noble/hashes/sha256';
import { hkdf } from '@noble/hashes/hkdf';
import { secp256k1 } from '@noble/curves/secp256k1';

export class DelegationManager {
  private storage: DelegationStorage;
  private registry?: OnChainRegistry;

  constructor(options: DelegationManagerOptions) {
    this.storage = options.storage || new InMemoryStorage();
    this.registry = options.registry;
  }

  async create(params: CreateDelegationParams): Promise<ViewingKeyDelegation> {
    // Validate params
    this.validateCreateParams(params);

    // Generate delegation ID
    const id = this.generateDelegationId();

    // Derive scoped key
    const scopedKey = this.deriveScopedKey(
      params.viewingKeyPair,
      params.scope,
      params.delegatee
    );

    // Encrypt scoped key for delegatee
    const encryptedKey = await this.encryptForDelegatee(
      scopedKey.privateKey,
      params.delegatee
    );

    // Create delegation object
    const delegation: ViewingKeyDelegation = {
      id,
      version: '1.0.0',
      delegator: params.viewingKeyPair.address,
      delegatee: params.delegatee,
      type: params.type,
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(params.expiresAt.getTime() / 1000),
      scope: params.scope,
      permissions: params.permissions,
      status: DelegationStatus.PENDING,
      encryptedViewingKey: encryptedKey,
      signature: this.signDelegation(params.viewingKeyPair, /* data */)
    };

    // Store delegation
    await this.storage.save(delegation);

    // Register on-chain if requested
    if (params.registerOnChain && this.registry) {
      const txHash = await this.registry.register(delegation);
      delegation.registryRef = {
        chain: this.registry.chain,
        txHash,
        registryAddress: this.registry.address
      };
      await this.storage.save(delegation);
    }

    // Emit event
    await this.emitEvent(DelegationEvent.CREATED, delegation);

    return delegation;
  }

  async revoke(
    delegationId: DelegationId,
    options: RevokeOptions
  ): Promise<RevocationResult> {
    const delegation = await this.storage.get(delegationId);
    if (!delegation) {
      throw new Error('Delegation not found');
    }

    // Calculate effective time
    const effectiveAt = this.calculateEffectiveTime(options);

    // Create revocation info
    const revocation: RevocationInfo = {
      initiatedAt: Math.floor(Date.now() / 1000),
      effectiveAt,
      type: options.type,
      reason: options.reason,
      initiatedBy: options.initiatedBy
    };

    // Update delegation
    delegation.status = DelegationStatus.REVOKED;
    delegation.revocation = revocation;
    await this.storage.save(delegation);

    // Revoke on-chain if registered
    if (delegation.registryRef && this.registry) {
      const txHash = await this.registry.revoke(delegationId, options.reason);
      revocation.onChainProof = {
        chain: delegation.registryRef.chain,
        txHash,
        blockNumber: await this.registry.getBlockNumber()
      };
    }

    // Emit event
    await this.emitEvent(DelegationEvent.REVOKED, delegation);

    // Emergency broadcast if needed
    if (options.type === RevocationType.EMERGENCY) {
      await this.broadcastEmergencyRevocation(delegation);
    }

    return { success: true, revocation, delegation };
  }

  async validate(delegationId: DelegationId): Promise<ValidationResult> {
    const delegation = await this.storage.get(delegationId);
    if (!delegation) {
      return { valid: false, reason: 'Delegation not found' };
    }

    // Check status
    if (delegation.status === DelegationStatus.REVOKED) {
      return {
        valid: false,
        reason: 'Delegation revoked',
        revocation: delegation.revocation
      };
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (delegation.expiresAt < now) {
      return { valid: false, reason: 'Delegation expired' };
    }

    // Check on-chain status
    if (delegation.registryRef && this.registry) {
      const onChainValid = await this.registry.isValid(delegationId);
      if (!onChainValid) {
        return { valid: false, reason: 'Revoked on-chain' };
      }
    }

    return { valid: true };
  }

  private deriveScopedKey(
    masterKey: ViewingKeyPair,
    scope: DelegationScope,
    delegatee: Address
  ): DerivedViewingKey {
    const scopeBytes = new TextEncoder().encode(
      JSON.stringify(scope, Object.keys(scope).sort())
    );
    const scopeCommitment = sha256(scopeBytes);

    const derivedPrivate = hkdf(
      sha256,
      hexToBytes(masterKey.privateKey),
      scopeCommitment,
      new TextEncoder().encode(`sip-delegation:${delegatee}`),
      32
    );

    const derivedPublic = secp256k1.getPublicKey(derivedPrivate);

    return {
      privateKey: bytesToHex(derivedPrivate),
      publicKey: bytesToHex(derivedPublic),
      scopeCommitment: bytesToHex(scopeCommitment),
      scope
    };
  }

  private generateDelegationId(): DelegationId {
    const random = new Uint8Array(32);
    crypto.getRandomValues(random);
    return `del_${bytesToHex(random)}` as DelegationId;
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

1. [SIP-003: Viewing Key Standard](./sip-eips/SIP-003-VIEWING-KEYS.md)
2. [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
3. [HKDF (RFC 5869)](https://tools.ietf.org/html/rfc5869)
4. [Compliance Whitepaper](../compliance/COMPLIANCE-WHITEPAPER.md)
5. [Institutional Integration Guide](../compliance/INSTITUTIONAL-INTEGRATION-GUIDE.md)

---

**Document Version:** 1.0.0
**Last Updated:** January 2026
