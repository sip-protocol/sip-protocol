# BitGo Multi-Sig + Viewing Keys Integration

**Version:** 1.0.0
**Status:** Draft
**Created:** January 2026
**Authors:** SIP Protocol Team

---

## Abstract

This specification defines the integration between SIP Protocol viewing keys and BitGo's institutional custody platform. The integration enables multi-signature wallets to maintain transaction privacy while providing selective disclosure capabilities through threshold viewing key schemes.

---

## Table of Contents

1. [Overview](#overview)
2. [BitGo Platform Integration](#bitgo-platform-integration)
3. [Multi-Sig Viewing Keys](#multi-sig-viewing-keys)
4. [Threshold Disclosure Schemes](#threshold-disclosure-schemes)
5. [Integration Architecture](#integration-architecture)
6. [API Specification](#api-specification)
7. [Custodian Audit Trail](#custodian-audit-trail)
8. [Security Model](#security-model)
9. [SDK Integration](#sdk-integration)
10. [Deployment Guide](#deployment-guide)

---

## 1. Overview

### 1.1 BitGo Platform

BitGo is a leading institutional digital asset custody provider offering:

- **Multi-Signature Security**: 2-of-3 or custom m-of-n configurations
- **Hot/Warm/Cold Wallets**: Tiered security architecture
- **Policy Engine**: Spend limits, whitelists, approval workflows
- **Enterprise API**: RESTful APIs with webhooks
- **Regulatory Compliance**: SOC 2 Type II, qualified custodian

### 1.2 Integration Goals

| Goal | Description |
|------|-------------|
| **Privacy for Multi-Sig** | Enable shielded transactions with multi-sig security |
| **Threshold Viewing** | m-of-n signers required to reconstruct viewing key |
| **Custodian Audit** | Individual key holders can audit their portion |
| **Policy Integration** | Privacy settings in BitGo policy engine |
| **Compliance Ready** | Full audit trail for regulators |

### 1.3 Use Cases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BITGO + SIP USE CASES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. DAO TREASURY                                                            │
│     • 3-of-5 multi-sig for spending                                        │
│     • 2-of-5 threshold viewing for audits                                  │
│     • Full disclosure to external auditor with all 5                       │
│                                                                             │
│  2. INSTITUTIONAL FUND                                                      │
│     • 2-of-3 hot wallet (BitGo, client, backup)                            │
│     • Privacy for competitive trades                                        │
│     • Fund admin viewing key for NAV calculation                           │
│                                                                             │
│  3. EXCHANGE COLD STORAGE                                                   │
│     • Multi-sig cold wallet                                                │
│     • Privacy for reserve amounts                                          │
│     • Proof of reserves without revealing exact holdings                   │
│                                                                             │
│  4. CORPORATE TREASURY                                                      │
│     • 2-of-3 with CFO, CEO, BitGo                                          │
│     • Board-level viewing access                                           │
│     • External auditor annual access                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. BitGo Platform Integration

### 2.1 BitGo API Overview

```typescript
/**
 * BitGo API client configuration
 */
interface BitGoConfig {
  /**
   * BitGo environment
   */
  env: 'test' | 'prod';

  /**
   * API access token
   */
  accessToken: string;

  /**
   * Enterprise ID (for enterprise accounts)
   */
  enterpriseId?: string;

  /**
   * Custom API URL (for self-hosted)
   */
  apiUrl?: string;
}

/**
 * BitGo wallet types supported
 */
enum BitGoWalletType {
  HOT = 'hot',
  WARM = 'warm',
  COLD = 'cold',
  CUSTODIAL = 'custodial',
  TRADING = 'trading'
}

/**
 * BitGo supported chains for SIP integration
 */
const BITGO_SIP_SUPPORTED_CHAINS = [
  'sol',      // Solana
  'eth',      // Ethereum
  'polygon',  // Polygon
  'avaxc',    // Avalanche C-Chain
  'near',     // NEAR Protocol
  'btc',      // Bitcoin (view-only)
] as const;
```

### 2.2 Wallet Structure

```typescript
/**
 * BitGo wallet with SIP privacy extension
 */
interface BitGoSIPWallet {
  /**
   * BitGo wallet ID
   */
  walletId: string;

  /**
   * Wallet label
   */
  label: string;

  /**
   * Coin type
   */
  coin: string;

  /**
   * Multi-sig configuration
   */
  multisig: {
    /**
     * Required signatures (m)
     */
    requiredSignatures: number;

    /**
     * Total key holders (n)
     */
    totalKeys: number;

    /**
     * Key holder details
     */
    keyHolders: KeyHolder[];
  };

  /**
   * SIP privacy configuration
   */
  sipPrivacy: {
    /**
     * Whether privacy is enabled
     */
    enabled: boolean;

    /**
     * Privacy level for transactions
     */
    defaultPrivacyLevel: PrivacyLevel;

    /**
     * Viewing key configuration
     */
    viewingKey: {
      /**
       * Master viewing public key
       */
      masterPublicKey: PublicKey;

      /**
       * Threshold scheme for viewing
       */
      thresholdScheme: ThresholdScheme;

      /**
       * Key shares for each holder
       */
      shares: ViewingKeyShare[];
    };

    /**
     * Compliance settings
     */
    compliance: {
      /**
       * Automatic disclosure for amounts above threshold
       */
      autoDisclosureThreshold?: bigint;

      /**
       * Required viewing key holders for compliance
       */
      complianceQuorum: number;
    };
  };
}

/**
 * Key holder in multi-sig
 */
interface KeyHolder {
  /**
   * Key holder identifier
   */
  id: string;

  /**
   * Key holder type
   */
  type: 'user' | 'bitgo' | 'backup';

  /**
   * Public key for this holder
   */
  publicKey: PublicKey;

  /**
   * Email (for notifications)
   */
  email?: string;

  /**
   * Role in organization
   */
  role?: string;
}
```

### 2.3 BitGo SDK Integration

```typescript
import { BitGo } from 'bitgo';
import { SIP, ThresholdViewingKey } from '@sip-protocol/sdk';

/**
 * Initialize BitGo client with SIP extension
 */
async function initBitGoSIP(config: BitGoConfig): Promise<BitGoSIPClient> {
  // Initialize BitGo SDK
  const bitgo = new BitGo({
    env: config.env,
    accessToken: config.accessToken
  });

  // Authenticate
  await bitgo.authenticate({
    accessToken: config.accessToken
  });

  // Initialize SIP client
  const sip = new SIP({
    chain: 'solana' // or other supported chain
  });

  return new BitGoSIPClient(bitgo, sip, config);
}

/**
 * BitGo + SIP combined client
 */
class BitGoSIPClient {
  constructor(
    private bitgo: BitGo,
    private sip: SIP,
    private config: BitGoConfig
  ) {}

  /**
   * Create privacy-enabled wallet
   */
  async createPrivacyWallet(
    params: CreatePrivacyWalletParams
  ): Promise<BitGoSIPWallet> {
    // 1. Create BitGo wallet
    const wallet = await this.bitgo.coin(params.coin).wallets().add({
      label: params.label,
      m: params.requiredSignatures,
      n: params.totalKeys,
      keys: params.keyIds,
      enterprise: this.config.enterpriseId
    });

    // 2. Generate threshold viewing key
    const thresholdVK = await this.sip.thresholdViewingKey.generate({
      threshold: params.viewingThreshold || Math.ceil(params.totalKeys / 2),
      totalShares: params.totalKeys
    });

    // 3. Distribute shares to key holders
    const shares = await this.distributeViewingKeyShares(
      wallet.id,
      params.keyHolders,
      thresholdVK.shares
    );

    // 4. Store SIP configuration
    await this.storeSIPConfig(wallet.id, {
      enabled: true,
      defaultPrivacyLevel: params.privacyLevel || 'shielded',
      viewingKey: {
        masterPublicKey: thresholdVK.publicKey,
        thresholdScheme: {
          threshold: params.viewingThreshold,
          total: params.totalKeys
        },
        shares
      },
      compliance: params.compliance
    });

    return this.getPrivacyWallet(wallet.id);
  }

  /**
   * Send shielded transaction
   */
  async sendShielded(
    walletId: string,
    params: ShieldedTransactionParams
  ): Promise<ShieldedTransactionResult> {
    const wallet = await this.getPrivacyWallet(walletId);

    // 1. Create shielded intent
    const intent = await this.sip.createShieldedIntent({
      recipient: params.recipient,
      amount: params.amount,
      asset: params.asset,
      privacyLevel: wallet.sipPrivacy.defaultPrivacyLevel,
      viewingKeyConfig: wallet.sipPrivacy.viewingKey
    });

    // 2. Build BitGo transaction
    const prebuild = await this.bitgo
      .coin(wallet.coin)
      .wallet(walletId)
      .prebuildTransaction({
        recipients: [{
          address: intent.outputAddress,
          amount: intent.encryptedAmount
        }],
        memo: intent.encryptedMemo
      });

    // 3. Request signatures (BitGo handles multi-sig flow)
    const signed = await this.bitgo
      .coin(wallet.coin)
      .wallet(walletId)
      .signTransaction({
        txPrebuild: prebuild,
        prv: params.userKeyPrv // User's private key
      });

    // 4. Submit transaction
    const result = await this.bitgo
      .coin(wallet.coin)
      .wallet(walletId)
      .submitTransaction({
        txHex: signed.txHex
      });

    return {
      txHash: result.txid,
      intent,
      status: result.status
    };
  }
}
```

---

## 3. Multi-Sig Viewing Keys

### 3.1 Viewing Key Distribution

```typescript
/**
 * Viewing key share for a multi-sig participant
 */
interface ViewingKeyShare {
  /**
   * Share identifier
   */
  shareId: string;

  /**
   * Key holder this share belongs to
   */
  holderId: string;

  /**
   * Share index (1-based)
   */
  index: number;

  /**
   * Encrypted share value
   */
  encryptedShare: EncryptedShare;

  /**
   * Commitment to share (for verification)
   */
  commitment: Commitment;

  /**
   * When share was created
   */
  createdAt: Timestamp;

  /**
   * Share status
   */
  status: 'active' | 'revoked' | 'rotated';
}

/**
 * Distribute viewing key shares to key holders
 */
async function distributeViewingKeyShares(
  walletId: string,
  keyHolders: KeyHolder[],
  shares: ThresholdShare[]
): Promise<ViewingKeyShare[]> {
  const distributedShares: ViewingKeyShare[] = [];

  for (let i = 0; i < keyHolders.length; i++) {
    const holder = keyHolders[i];
    const share = shares[i];

    // Encrypt share for holder's public key
    const encryptedShare = await encryptForRecipient(
      share.value,
      holder.publicKey
    );

    const viewingShare: ViewingKeyShare = {
      shareId: generateShareId(),
      holderId: holder.id,
      index: i + 1,
      encryptedShare,
      commitment: share.commitment,
      createdAt: Math.floor(Date.now() / 1000),
      status: 'active'
    };

    distributedShares.push(viewingShare);

    // Notify holder (via email or webhook)
    await notifyShareDistribution(holder, viewingShare, walletId);
  }

  return distributedShares;
}
```

### 3.2 Multi-Sig Privacy Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MULTI-SIG PRIVACY TRANSACTION FLOW                      │
└─────────────────────────────────────────────────────────────────────────────┘

  Key Holder A        Key Holder B        BitGo          Recipient
       │                   │                │                │
       │ 1. Initiate       │                │                │
       │    Shielded Tx    │                │                │
       ├──────────────────►│                │                │
       │                   │                │                │
       │ 2. Generate Stealth Address        │                │
       │◄─────────────────────────────────────────────────────┤
       │                   │                │                │
       │ 3. Create Encrypted Intent         │                │
       ├──────────────────────────────────►│                │
       │                   │                │                │
       │ 4. Prebuild Transaction            │                │
       │◄──────────────────────────────────┤                │
       │                   │                │                │
       │ 5. Sign (1st signature)            │                │
       ├──────────────────►│                │                │
       │                   │                │                │
       │                   │ 6. Sign (2nd)  │                │
       │                   ├───────────────►│                │
       │                   │                │                │
       │                   │ 7. BitGo Signs │                │
       │                   │◄───────────────┤                │
       │                   │                │                │
       │ 8. Broadcast Shielded Transaction  │                │
       │──────────────────────────────────────────────────────┤
       │                   │                │                │
       │ 9. Recipient Scans with Viewing Key                 │
       │                   │                │◄───────────────┤
       │                   │                │                │
       ▼                   ▼                ▼                ▼
```

### 3.3 Viewing Key Reconstruction

```typescript
/**
 * Reconstruct viewing key from threshold shares
 */
async function reconstructViewingKey(
  walletId: string,
  shares: DecryptedShare[],
  scheme: ThresholdScheme
): Promise<ViewingKeyPair> {
  // Verify we have enough shares
  if (shares.length < scheme.threshold) {
    throw new Error(
      `Need ${scheme.threshold} shares, only have ${shares.length}`
    );
  }

  // Verify share commitments
  for (const share of shares) {
    const valid = verifyShareCommitment(share);
    if (!valid) {
      throw new Error(`Invalid share commitment: ${share.shareId}`);
    }
  }

  // Lagrange interpolation to reconstruct secret
  const reconstructedSecret = lagrangeInterpolate(
    shares.map(s => ({ x: s.index, y: s.value }))
  );

  // Derive viewing key pair from reconstructed secret
  const viewingKeyPair = deriveViewingKeyFromSecret(reconstructedSecret);

  return viewingKeyPair;
}

/**
 * Lagrange interpolation for secret reconstruction
 */
function lagrangeInterpolate(
  points: Array<{ x: number; y: bigint }>
): bigint {
  const order = secp256k1.CURVE.n;
  let result = 0n;

  for (let i = 0; i < points.length; i++) {
    let numerator = 1n;
    let denominator = 1n;

    for (let j = 0; j < points.length; j++) {
      if (i !== j) {
        numerator = mod(
          numerator * BigInt(-points[j].x),
          order
        );
        denominator = mod(
          denominator * BigInt(points[i].x - points[j].x),
          order
        );
      }
    }

    const lagrangeCoeff = mod(
      numerator * modInverse(denominator, order),
      order
    );

    result = mod(
      result + points[i].y * lagrangeCoeff,
      order
    );
  }

  return result;
}
```

---

## 4. Threshold Disclosure Schemes

### 4.1 Scheme Configurations

```typescript
/**
 * Threshold viewing key scheme
 */
interface ThresholdScheme {
  /**
   * Minimum shares required to reconstruct
   */
  threshold: number;

  /**
   * Total number of shares
   */
  total: number;

  /**
   * Scheme type
   */
  type: ThresholdSchemeType;

  /**
   * Optional: Different thresholds for different purposes
   */
  purposeThresholds?: PurposeThreshold[];
}

enum ThresholdSchemeType {
  /**
   * Standard Shamir Secret Sharing
   */
  SHAMIR = 'shamir',

  /**
   * Feldman Verifiable Secret Sharing
   */
  FELDMAN = 'feldman',

  /**
   * Pedersen Verifiable Secret Sharing
   */
  PEDERSEN = 'pedersen'
}

/**
 * Different thresholds for different purposes
 */
interface PurposeThreshold {
  /**
   * Purpose identifier
   */
  purpose: ViewingPurpose;

  /**
   * Threshold for this purpose
   */
  threshold: number;

  /**
   * Description
   */
  description: string;
}

enum ViewingPurpose {
  /**
   * View individual transactions
   */
  VIEW_TRANSACTIONS = 'view_transactions',

  /**
   * View balance/totals
   */
  VIEW_BALANCE = 'view_balance',

  /**
   * Generate compliance reports
   */
  COMPLIANCE_REPORT = 'compliance_report',

  /**
   * Full historical disclosure
   */
  FULL_DISCLOSURE = 'full_disclosure',

  /**
   * Real-time monitoring
   */
  REAL_TIME_MONITORING = 'real_time_monitoring'
}

/**
 * Example configurations
 */
const THRESHOLD_SCHEME_EXAMPLES: Record<string, ThresholdScheme> = {
  // 2-of-3 basic
  'basic_2_of_3': {
    threshold: 2,
    total: 3,
    type: ThresholdSchemeType.FELDMAN
  },

  // 3-of-5 DAO with graduated access
  'dao_graduated': {
    threshold: 3,
    total: 5,
    type: ThresholdSchemeType.PEDERSEN,
    purposeThresholds: [
      {
        purpose: ViewingPurpose.VIEW_BALANCE,
        threshold: 2,
        description: 'Any 2 signers can check balance'
      },
      {
        purpose: ViewingPurpose.VIEW_TRANSACTIONS,
        threshold: 3,
        description: '3 signers for transaction details'
      },
      {
        purpose: ViewingPurpose.COMPLIANCE_REPORT,
        threshold: 3,
        description: '3 signers for compliance reports'
      },
      {
        purpose: ViewingPurpose.FULL_DISCLOSURE,
        threshold: 5,
        description: 'All 5 for full historical access'
      }
    ]
  },

  // Institutional with BitGo always required
  'institutional_with_bitgo': {
    threshold: 2,
    total: 3,
    type: ThresholdSchemeType.FELDMAN,
    purposeThresholds: [
      {
        purpose: ViewingPurpose.COMPLIANCE_REPORT,
        threshold: 2,
        description: 'BitGo + 1 signer for compliance'
      }
    ]
  }
};
```

### 4.2 Graduated Access Control

```typescript
/**
 * Check if threshold is met for a specific purpose
 */
function checkPurposeThreshold(
  scheme: ThresholdScheme,
  purpose: ViewingPurpose,
  availableShares: number
): boolean {
  // Check purpose-specific threshold if defined
  if (scheme.purposeThresholds) {
    const purposeConfig = scheme.purposeThresholds.find(
      p => p.purpose === purpose
    );
    if (purposeConfig) {
      return availableShares >= purposeConfig.threshold;
    }
  }

  // Fall back to default threshold
  return availableShares >= scheme.threshold;
}

/**
 * Get available viewing capabilities based on shares
 */
function getAvailableCapabilities(
  scheme: ThresholdScheme,
  availableShares: number
): ViewingPurpose[] {
  const capabilities: ViewingPurpose[] = [];

  if (!scheme.purposeThresholds) {
    // Standard scheme: all or nothing
    if (availableShares >= scheme.threshold) {
      return Object.values(ViewingPurpose);
    }
    return [];
  }

  // Graduated scheme: check each purpose
  for (const pt of scheme.purposeThresholds) {
    if (availableShares >= pt.threshold) {
      capabilities.push(pt.purpose);
    }
  }

  return capabilities;
}

/**
 * Request viewing access with available shares
 */
async function requestViewingAccess(
  walletId: string,
  shares: DecryptedShare[],
  purpose: ViewingPurpose
): Promise<ViewingAccessResult> {
  const wallet = await getPrivacyWallet(walletId);
  const scheme = wallet.sipPrivacy.viewingKey.thresholdScheme;

  // Check if threshold is met
  const thresholdMet = checkPurposeThreshold(
    scheme,
    purpose,
    shares.length
  );

  if (!thresholdMet) {
    const required = getRequiredThreshold(scheme, purpose);
    return {
      granted: false,
      reason: `Need ${required} shares, have ${shares.length}`,
      missingShares: required - shares.length
    };
  }

  // Reconstruct viewing key for this purpose
  const viewingKey = await reconstructViewingKey(walletId, shares, scheme);

  // Generate scoped access token
  const accessToken = await generateScopedAccessToken(
    viewingKey,
    purpose,
    shares.map(s => s.holderId)
  );

  return {
    granted: true,
    accessToken,
    capabilities: [purpose],
    expiresAt: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  };
}
```

### 4.3 Verifiable Secret Sharing

```typescript
/**
 * Feldman VSS share generation
 */
async function generateFeldmanShares(
  secret: bigint,
  threshold: number,
  total: number
): Promise<FeldmanShares> {
  const G = secp256k1.ProjectivePoint.BASE;
  const order = secp256k1.CURVE.n;

  // Generate random polynomial coefficients
  const coefficients: bigint[] = [secret];
  for (let i = 1; i < threshold; i++) {
    coefficients.push(randomBigInt(order));
  }

  // Calculate commitments C_i = a_i * G
  const commitments = coefficients.map(coef =>
    G.multiply(coef).toHex()
  );

  // Generate shares: f(i) for i = 1, 2, ..., n
  const shares: ThresholdShare[] = [];
  for (let i = 1; i <= total; i++) {
    let value = 0n;
    for (let j = 0; j < threshold; j++) {
      value = mod(
        value + coefficients[j] * BigInt(i ** j),
        order
      );
    }
    shares.push({
      index: i,
      value,
      commitment: commitments[0] // Simplified; full commitment is all C_i
    });
  }

  return {
    shares,
    commitments,
    publicKey: G.multiply(secret).toHex()
  };
}

/**
 * Verify a Feldman share
 */
function verifyFeldmanShare(
  share: ThresholdShare,
  commitments: string[]
): boolean {
  const G = secp256k1.ProjectivePoint.BASE;

  // Calculate share commitment: share.value * G
  const shareCommitment = G.multiply(share.value);

  // Calculate expected commitment: Σ (i^j * C_j)
  let expectedCommitment = secp256k1.ProjectivePoint.ZERO;
  for (let j = 0; j < commitments.length; j++) {
    const C_j = secp256k1.ProjectivePoint.fromHex(commitments[j]);
    const power = BigInt(share.index ** j);
    expectedCommitment = expectedCommitment.add(C_j.multiply(power));
  }

  return shareCommitment.equals(expectedCommitment);
}
```

---

## 5. Integration Architecture

### 5.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BITGO + SIP INTEGRATION ARCHITECTURE                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Key Holder    │     │   Key Holder    │     │   Key Holder    │
│   (User App)    │     │   (Mobile)      │     │   (BitGo HSM)   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ Viewing Share         │ Viewing Share         │ Viewing Share
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SIP BITGO INTEGRATION LAYER                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Threshold Key   │  │ Multi-Sig       │  │ Compliance      │              │
│  │ Manager         │  │ Coordinator     │  │ Reporter        │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   BitGo API     │     │   SIP Protocol  │     │   Blockchain    │
│   (Custody)     │     │   (Privacy)     │     │   (Settlement)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 5.2 Component Interactions

```typescript
/**
 * BitGo SIP Integration Layer
 */
class BitGoSIPIntegration {
  private thresholdKeyManager: ThresholdKeyManager;
  private multiSigCoordinator: MultiSigCoordinator;
  private complianceReporter: ComplianceReporter;
  private bitgoClient: BitGo;
  private sipClient: SIP;

  constructor(config: IntegrationConfig) {
    this.thresholdKeyManager = new ThresholdKeyManager(config);
    this.multiSigCoordinator = new MultiSigCoordinator(config);
    this.complianceReporter = new ComplianceReporter(config);
    this.bitgoClient = new BitGo(config.bitgo);
    this.sipClient = new SIP(config.sip);
  }

  /**
   * Create privacy-enabled multi-sig wallet
   */
  async createWallet(params: CreateWalletParams): Promise<BitGoSIPWallet> {
    // Create BitGo wallet
    const bitgoWallet = await this.bitgoClient
      .coin(params.coin)
      .wallets()
      .add(params);

    // Generate threshold viewing key
    const thresholdVK = await this.thresholdKeyManager.generate(
      params.viewingThreshold,
      params.totalKeys
    );

    // Distribute shares
    await this.thresholdKeyManager.distributeShares(
      bitgoWallet.id,
      params.keyHolders,
      thresholdVK.shares
    );

    return this.wrapWallet(bitgoWallet, thresholdVK);
  }

  /**
   * Execute shielded transaction
   */
  async sendShielded(
    walletId: string,
    params: ShieldedTxParams
  ): Promise<ShieldedTxResult> {
    // Generate stealth address for recipient
    const stealth = await this.sipClient.generateStealthAddress(
      params.recipientMeta
    );

    // Create commitment for amount
    const commitment = await this.sipClient.createCommitment(params.amount);

    // Coordinate multi-sig signing
    const signedTx = await this.multiSigCoordinator.signTransaction({
      walletId,
      recipient: stealth.address,
      amount: commitment.value,
      signers: params.signers
    });

    // Broadcast
    return this.broadcastTransaction(walletId, signedTx);
  }

  /**
   * Request viewing access with threshold shares
   */
  async requestViewingAccess(
    walletId: string,
    shares: EncryptedShare[],
    purpose: ViewingPurpose
  ): Promise<ViewingSession> {
    return this.thresholdKeyManager.createSession(
      walletId,
      shares,
      purpose
    );
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    walletId: string,
    session: ViewingSession,
    params: ReportParams
  ): Promise<ComplianceReport> {
    return this.complianceReporter.generate(
      walletId,
      session,
      params
    );
  }
}
```

---

## 6. API Specification

### 6.1 Wallet Management

```typescript
/**
 * POST /wallets
 * Create privacy-enabled BitGo wallet
 */
interface CreatePrivacyWalletRequest {
  /**
   * Coin type (sol, eth, etc.)
   */
  coin: string;

  /**
   * Wallet label
   */
  label: string;

  /**
   * Required signatures for spending (m)
   */
  requiredSignatures: number;

  /**
   * Total key holders (n)
   */
  totalKeys: number;

  /**
   * Key holder configurations
   */
  keyHolders: KeyHolderConfig[];

  /**
   * Viewing key threshold (defaults to requiredSignatures)
   */
  viewingThreshold?: number;

  /**
   * Default privacy level
   */
  privacyLevel?: PrivacyLevel;

  /**
   * Threshold scheme type
   */
  thresholdSchemeType?: ThresholdSchemeType;

  /**
   * Purpose-specific thresholds
   */
  purposeThresholds?: PurposeThreshold[];
}

interface CreatePrivacyWalletResponse {
  /**
   * Wallet ID
   */
  walletId: string;

  /**
   * Wallet address
   */
  address: string;

  /**
   * SIP stealth meta-address
   */
  stealthMetaAddress: string;

  /**
   * Viewing key configuration
   */
  viewingKey: {
    publicKey: string;
    thresholdScheme: ThresholdScheme;
  };

  /**
   * Key holder share assignments
   */
  shareAssignments: ShareAssignment[];
}

/**
 * GET /wallets/:walletId
 * Get wallet details including privacy configuration
 */
interface GetWalletResponse extends BitGoSIPWallet {}

/**
 * PUT /wallets/:walletId/privacy
 * Update wallet privacy settings
 */
interface UpdatePrivacySettingsRequest {
  /**
   * New default privacy level
   */
  privacyLevel?: PrivacyLevel;

  /**
   * Update compliance settings
   */
  compliance?: {
    autoDisclosureThreshold?: bigint;
    complianceQuorum?: number;
  };
}
```

### 6.2 Transaction Operations

```typescript
/**
 * POST /wallets/:walletId/transactions/shielded
 * Create shielded transaction
 */
interface ShieldedTransactionRequest {
  /**
   * Recipient stealth meta-address or standard address
   */
  recipient: string;

  /**
   * Amount in base units
   */
  amount: string;

  /**
   * Asset (native or token address)
   */
  asset?: string;

  /**
   * Privacy level for this transaction
   */
  privacyLevel?: PrivacyLevel;

  /**
   * Memo (will be encrypted)
   */
  memo?: string;

  /**
   * Signers (must meet threshold)
   */
  signers: SignerConfig[];
}

interface ShieldedTransactionResponse {
  /**
   * Transaction hash
   */
  txHash: string;

  /**
   * Transaction status
   */
  status: 'pending' | 'signed' | 'broadcast' | 'confirmed';

  /**
   * Stealth address used
   */
  stealthAddress: string;

  /**
   * Encrypted amount commitment
   */
  commitment: string;

  /**
   * Signatures collected
   */
  signatures: {
    holderId: string;
    signed: boolean;
  }[];
}

/**
 * GET /wallets/:walletId/transactions
 * Get transactions (requires viewing access)
 */
interface GetTransactionsRequest {
  /**
   * Viewing session token
   */
  sessionToken: string;

  /**
   * Pagination
   */
  limit?: number;
  offset?: number;

  /**
   * Filters
   */
  startDate?: string;
  endDate?: string;
  minAmount?: string;
  maxAmount?: string;
}

interface GetTransactionsResponse {
  /**
   * Decrypted transactions
   */
  transactions: DecryptedTransaction[];

  /**
   * Pagination info
   */
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}
```

### 6.3 Viewing Access

```typescript
/**
 * POST /wallets/:walletId/viewing/sessions
 * Create viewing session with threshold shares
 */
interface CreateViewingSessionRequest {
  /**
   * Purpose of viewing access
   */
  purpose: ViewingPurpose;

  /**
   * Shares from key holders
   */
  shares: {
    holderId: string;
    encryptedShare: string;
    signature: string; // Proof of holder identity
  }[];

  /**
   * Session duration (max 24 hours)
   */
  durationSeconds?: number;
}

interface CreateViewingSessionResponse {
  /**
   * Session token for subsequent requests
   */
  sessionToken: string;

  /**
   * Granted capabilities
   */
  capabilities: ViewingPurpose[];

  /**
   * Session expiry
   */
  expiresAt: string;

  /**
   * Shares used
   */
  sharesUsed: number;

  /**
   * Key holders who contributed
   */
  contributors: string[];
}

/**
 * DELETE /wallets/:walletId/viewing/sessions/:sessionToken
 * Revoke viewing session
 */
interface RevokeSessionResponse {
  revoked: boolean;
  revokedAt: string;
}

/**
 * GET /wallets/:walletId/viewing/shares
 * Get share status for all key holders
 */
interface GetSharesResponse {
  shares: {
    holderId: string;
    index: number;
    status: 'active' | 'revoked' | 'rotated';
    lastUsed?: string;
  }[];
}
```

### 6.4 Compliance Reporting

```typescript
/**
 * POST /wallets/:walletId/reports/compliance
 * Generate compliance report
 */
interface GenerateComplianceReportRequest {
  /**
   * Viewing session token
   */
  sessionToken: string;

  /**
   * Report type
   */
  reportType: 'transaction_summary' | 'balance_proof' | 'full_audit';

  /**
   * Time period
   */
  period: {
    start: string;
    end: string;
  };

  /**
   * Output format
   */
  format: 'pdf' | 'csv' | 'json';

  /**
   * Include cryptographic proofs
   */
  includeProofs?: boolean;
}

interface ComplianceReportResponse {
  /**
   * Report ID
   */
  reportId: string;

  /**
   * Report download URL (expires in 1 hour)
   */
  downloadUrl: string;

  /**
   * Report metadata
   */
  metadata: {
    walletId: string;
    period: { start: string; end: string };
    transactionCount: number;
    totalVolume: string;
    generatedAt: string;
    generatedBy: string[]; // Key holders who contributed
  };

  /**
   * Cryptographic verification data
   */
  verification: {
    reportHash: string;
    signatures: {
      holderId: string;
      signature: string;
    }[];
  };
}
```

---

## 7. Custodian Audit Trail

### 7.1 Audit Log Structure

```typescript
/**
 * Audit log entry for custodian actions
 */
interface CustodianAuditEntry {
  /**
   * Entry ID
   */
  id: string;

  /**
   * Wallet ID
   */
  walletId: string;

  /**
   * Event type
   */
  event: CustodianEvent;

  /**
   * Timestamp
   */
  timestamp: Timestamp;

  /**
   * Actor (key holder ID or 'system')
   */
  actor: string;

  /**
   * Event-specific details
   */
  details: Record<string, unknown>;

  /**
   * Actor's signature over the entry
   */
  signature?: Signature;

  /**
   * Hash of previous entry (chain)
   */
  previousHash: HexString;

  /**
   * Entry hash
   */
  entryHash: HexString;
}

enum CustodianEvent {
  // Wallet Events
  WALLET_CREATED = 'wallet.created',
  WALLET_PRIVACY_ENABLED = 'wallet.privacy_enabled',
  WALLET_SETTINGS_UPDATED = 'wallet.settings_updated',

  // Transaction Events
  TRANSACTION_INITIATED = 'transaction.initiated',
  TRANSACTION_SIGNED = 'transaction.signed',
  TRANSACTION_BROADCAST = 'transaction.broadcast',
  TRANSACTION_CONFIRMED = 'transaction.confirmed',

  // Viewing Events
  VIEWING_SESSION_CREATED = 'viewing.session_created',
  VIEWING_SESSION_USED = 'viewing.session_used',
  VIEWING_SESSION_REVOKED = 'viewing.session_revoked',

  // Share Events
  SHARE_DISTRIBUTED = 'share.distributed',
  SHARE_USED = 'share.used',
  SHARE_ROTATED = 'share.rotated',

  // Report Events
  REPORT_GENERATED = 'report.generated',
  REPORT_DOWNLOADED = 'report.downloaded'
}
```

### 7.2 Audit Trail Verification

```typescript
/**
 * Verify audit trail integrity
 */
async function verifyAuditTrail(
  walletId: string,
  entries: CustodianAuditEntry[]
): Promise<AuditVerificationResult> {
  const errors: AuditError[] = [];

  // Sort by timestamp
  const sorted = entries.sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];

    // Verify hash chain
    if (i > 0) {
      const expectedPrevHash = sorted[i - 1].entryHash;
      if (entry.previousHash !== expectedPrevHash) {
        errors.push({
          entryId: entry.id,
          error: 'Hash chain broken',
          expected: expectedPrevHash,
          actual: entry.previousHash
        });
      }
    }

    // Verify entry hash
    const calculatedHash = calculateEntryHash(entry);
    if (entry.entryHash !== calculatedHash) {
      errors.push({
        entryId: entry.id,
        error: 'Entry hash mismatch',
        expected: calculatedHash,
        actual: entry.entryHash
      });
    }

    // Verify signature if present
    if (entry.signature) {
      const keyHolder = await getKeyHolder(entry.actor);
      if (keyHolder) {
        const signatureValid = verify(
          entry.signature,
          entry.entryHash,
          keyHolder.publicKey
        );
        if (!signatureValid) {
          errors.push({
            entryId: entry.id,
            error: 'Invalid signature'
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    entriesVerified: sorted.length,
    errors
  };
}
```

### 7.3 Audit Export

```typescript
/**
 * Export audit trail for external verification
 */
async function exportAuditTrail(
  walletId: string,
  options: AuditExportOptions
): Promise<AuditExport> {
  // Get entries in range
  const entries = await getAuditEntries(walletId, {
    startDate: options.startDate,
    endDate: options.endDate,
    events: options.events
  });

  // Generate Merkle root
  const merkleRoot = calculateMerkleRoot(
    entries.map(e => e.entryHash)
  );

  // Get key holder signatures
  const attestations = await collectAttestations(
    walletId,
    merkleRoot,
    options.attestingHolders
  );

  return {
    walletId,
    period: {
      start: options.startDate,
      end: options.endDate
    },
    entries,
    merkleRoot,
    attestations,
    exportedAt: Math.floor(Date.now() / 1000),
    format: options.format
  };
}
```

---

## 8. Security Model

### 8.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Single key holder compromise | Threshold scheme requires multiple shares |
| BitGo compromise | BitGo only holds one share; cannot reconstruct alone |
| Share theft during distribution | Shares encrypted for recipient's public key |
| Replay of viewing session | Nonces, expiring session tokens |
| Unauthorized viewing | Threshold enforcement, audit logging |
| Audit trail tampering | Hash chain, multi-party signatures |
| Collusion (threshold parties) | Cannot prevent, but can detect via audit |

### 8.2 Security Recommendations

```typescript
/**
 * Security best practices for BitGo + SIP integration
 */
const SECURITY_BEST_PRACTICES = {
  // Threshold Configuration
  threshold: {
    /**
     * Minimum viewing threshold
     * Should be at least 2 to prevent single-party access
     */
    minimumViewingThreshold: 2,

    /**
     * Recommended: viewing threshold = spending threshold
     * Ensures same security level for viewing as spending
     */
    viewingEqualsSpending: true,

    /**
     * For highly sensitive wallets, require all parties
     * for full disclosure
     */
    fullDisclosureRequiresAll: true
  },

  // Session Management
  sessions: {
    /**
     * Maximum session duration (seconds)
     */
    maxSessionDuration: 86400, // 24 hours

    /**
     * Default session duration (seconds)
     */
    defaultSessionDuration: 3600, // 1 hour

    /**
     * Require re-authentication for each session
     */
    requireReauth: true,

    /**
     * Maximum concurrent sessions per wallet
     */
    maxConcurrentSessions: 3
  },

  // Audit Trail
  audit: {
    /**
     * Require signature on all audit entries
     */
    requireSignatures: true,

    /**
     * Retention period (days)
     */
    retentionPeriod: 2555, // ~7 years

    /**
     * Export requires threshold attestation
     */
    exportRequiresAttestation: true
  },

  // Key Rotation
  rotation: {
    /**
     * Maximum share age before rotation required (days)
     */
    maxShareAge: 365,

    /**
     * Rotation requires all current key holders
     */
    rotationRequiresAll: true
  }
};
```

### 8.3 Incident Response

```typescript
/**
 * Emergency procedures
 */
interface EmergencyProcedures {
  /**
   * Suspend all viewing sessions
   */
  suspendAllSessions(walletId: string): Promise<void>;

  /**
   * Rotate all viewing key shares
   */
  emergencyRotation(
    walletId: string,
    newKeyHolders: KeyHolder[]
  ): Promise<RotationResult>;

  /**
   * Revoke specific key holder's share
   */
  revokeShare(
    walletId: string,
    holderId: string,
    reason: string
  ): Promise<RevokeResult>;

  /**
   * Freeze wallet (requires BitGo policy)
   */
  freezeWallet(walletId: string, reason: string): Promise<FreezeResult>;
}

/**
 * Emergency share revocation
 */
async function revokeShare(
  walletId: string,
  holderId: string,
  reason: string
): Promise<RevokeResult> {
  // 1. Mark share as revoked
  await updateShareStatus(walletId, holderId, 'revoked');

  // 2. Invalidate all sessions using this share
  await invalidateSessionsWithShare(walletId, holderId);

  // 3. Log revocation
  await logAuditEntry({
    walletId,
    event: CustodianEvent.SHARE_ROTATED,
    actor: 'system',
    details: {
      holderId,
      reason,
      action: 'revoked'
    }
  });

  // 4. Notify other key holders
  await notifyKeyHolders(walletId, {
    event: 'share_revoked',
    holderId,
    reason
  });

  // 5. If below threshold, trigger rotation
  const activeShares = await countActiveShares(walletId);
  const wallet = await getPrivacyWallet(walletId);
  if (activeShares < wallet.sipPrivacy.viewingKey.thresholdScheme.total) {
    return {
      success: true,
      rotationRequired: true,
      activeShares
    };
  }

  return {
    success: true,
    rotationRequired: false,
    activeShares
  };
}
```

---

## 9. SDK Integration

### 9.1 TypeScript SDK

```typescript
import { BitGoSIP } from '@sip-protocol/bitgo';

// Initialize integration
const bitgoSip = new BitGoSIP({
  bitgo: {
    env: 'test',
    accessToken: process.env.BITGO_TOKEN
  },
  sip: {
    chain: 'solana'
  }
});

// Create privacy-enabled wallet
const wallet = await bitgoSip.createWallet({
  coin: 'sol',
  label: 'DAO Treasury',
  requiredSignatures: 2,
  totalKeys: 3,
  keyHolders: [
    { id: 'user1', type: 'user', publicKey: '...' },
    { id: 'user2', type: 'user', publicKey: '...' },
    { id: 'bitgo', type: 'bitgo' }
  ],
  viewingThreshold: 2,
  privacyLevel: 'shielded'
});

console.log('Wallet created:', wallet.walletId);
console.log('Stealth address:', wallet.stealthMetaAddress);

// Send shielded transaction
const tx = await bitgoSip.sendShielded(wallet.walletId, {
  recipient: 'sip:solana:0x...',
  amount: '1000000000', // 1 SOL
  signers: [
    { holderId: 'user1', privateKey: user1Key },
    { holderId: 'user2', privateKey: user2Key }
  ]
});

console.log('Transaction:', tx.txHash);

// Request viewing access (needs 2 of 3 shares)
const session = await bitgoSip.requestViewingAccess(wallet.walletId, {
  purpose: 'compliance_report',
  shares: [
    { holderId: 'user1', share: user1Share },
    { holderId: 'user2', share: user2Share }
  ]
});

// Generate compliance report
const report = await bitgoSip.generateReport(wallet.walletId, {
  sessionToken: session.sessionToken,
  reportType: 'transaction_summary',
  period: { start: '2025-01-01', end: '2025-12-31' },
  format: 'pdf'
});

console.log('Report:', report.downloadUrl);
```

### 9.2 React Components

```tsx
import {
  BitGoWalletProvider,
  usePrivacyWallet,
  useViewingSession,
  useComplianceReport
} from '@sip-protocol/bitgo-react';

function WalletDashboard({ walletId }: { walletId: string }) {
  const { wallet, loading } = usePrivacyWallet(walletId);
  const { session, requestAccess, revokeSession } = useViewingSession(walletId);

  const handleRequestAccess = async () => {
    const shares = await collectSharesFromHolders();
    await requestAccess({
      purpose: 'view_balance',
      shares
    });
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <h2>{wallet.label}</h2>
      <p>Multi-sig: {wallet.multisig.requiredSignatures}-of-{wallet.multisig.totalKeys}</p>
      <p>Viewing threshold: {wallet.sipPrivacy.viewingKey.thresholdScheme.threshold}</p>

      {session ? (
        <ViewingSessionPanel
          session={session}
          onRevoke={revokeSession}
        />
      ) : (
        <button onClick={handleRequestAccess}>
          Request Viewing Access
        </button>
      )}

      <KeyHoldersList holders={wallet.multisig.keyHolders} />
    </div>
  );
}

function ComplianceReportGenerator({ walletId }: { walletId: string }) {
  const { session } = useViewingSession(walletId);
  const { generateReport, report, generating } = useComplianceReport(walletId);

  if (!session) {
    return <p>Viewing session required</p>;
  }

  return (
    <div>
      <button
        onClick={() => generateReport({
          sessionToken: session.sessionToken,
          reportType: 'full_audit',
          period: { start: '2025-01-01', end: '2025-12-31' },
          format: 'pdf'
        })}
        disabled={generating}
      >
        {generating ? 'Generating...' : 'Generate Compliance Report'}
      </button>

      {report && (
        <a href={report.downloadUrl} download>
          Download Report
        </a>
      )}
    </div>
  );
}
```

### 9.3 CLI Commands

```bash
# Create privacy wallet
sip bitgo create-wallet \
  --coin sol \
  --label "DAO Treasury" \
  --m 2 --n 3 \
  --viewing-threshold 2 \
  --key-holders user1.pub,user2.pub,bitgo

# Send shielded transaction
sip bitgo send \
  --wallet wal_abc123 \
  --recipient sip:solana:0x... \
  --amount 1.0 \
  --signers user1,user2

# Request viewing access
sip bitgo viewing request \
  --wallet wal_abc123 \
  --purpose compliance_report \
  --shares user1.share,user2.share

# Generate compliance report
sip bitgo report \
  --wallet wal_abc123 \
  --session sess_xyz789 \
  --type full_audit \
  --period 2025-01-01,2025-12-31 \
  --format pdf \
  --output audit-2025.pdf

# View audit trail
sip bitgo audit-trail \
  --wallet wal_abc123 \
  --start 2025-01-01 \
  --end 2025-12-31

# Rotate viewing key shares
sip bitgo rotate-shares \
  --wallet wal_abc123 \
  --new-holders user1.pub,user3.pub,bitgo
```

---

## 10. Deployment Guide

### 10.1 Prerequisites

- BitGo Enterprise account
- API access token with wallet permissions
- Key holders with:
  - Secure key storage (HSM recommended)
  - Secure communication channel

### 10.2 Setup Steps

```bash
# 1. Install SDK
npm install @sip-protocol/bitgo

# 2. Configure environment
export BITGO_ENV=test  # or prod
export BITGO_TOKEN=your_access_token
export BITGO_ENTERPRISE=your_enterprise_id

# 3. Initialize integration
sip bitgo init \
  --env $BITGO_ENV \
  --token $BITGO_TOKEN \
  --enterprise $BITGO_ENTERPRISE

# 4. Create test wallet
sip bitgo create-wallet \
  --coin tsol \  # Testnet SOL
  --label "Test Treasury" \
  --m 2 --n 3 \
  --viewing-threshold 2

# 5. Verify setup
sip bitgo verify --wallet wal_test123
```

### 10.3 Production Checklist

- [ ] BitGo production environment configured
- [ ] All key holders have secure key storage
- [ ] Viewing key shares distributed securely
- [ ] Threshold scheme validated
- [ ] Policy engine configured for privacy transactions
- [ ] Webhook endpoints registered
- [ ] Audit trail export tested
- [ ] Emergency procedures documented
- [ ] Key rotation procedure tested
- [ ] Compliance report generation validated

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | January 2026 | Initial specification |

---

## References

1. [BitGo Developer Documentation](https://developers.bitgo.com/)
2. [Shamir Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing)
3. [Feldman VSS](https://www.cs.umd.edu/~gasarch/TOPICS/secretsharing/feldmanVSS.pdf)
4. [SIP-003: Viewing Key Standard](../../specs/sip-eips/SIP-003-VIEWING-KEYS.md)
5. [Time-Bound Delegation Specification](../../specs/TIME-BOUND-DELEGATION.md)

---

**Document Version:** 1.0.0
**Last Updated:** January 2026
