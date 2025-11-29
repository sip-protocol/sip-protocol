/**
 * DAO Treasury Management for SIP Protocol
 *
 * Provides privacy-preserving treasury operations with multi-sig support.
 *
 * @example
 * ```typescript
 * // Create a treasury
 * const treasury = await Treasury.create({
 *   name: 'DAO Treasury',
 *   chain: 'ethereum',
 *   members: [
 *     { address: '0x...', publicKey: '0x...', role: 'owner', name: 'Alice' },
 *     { address: '0x...', publicKey: '0x...', role: 'signer', name: 'Bob' },
 *     { address: '0x...', publicKey: '0x...', role: 'signer', name: 'Carol' },
 *   ],
 *   signingThreshold: 2, // 2-of-3 multi-sig
 * })
 *
 * // Create a payment proposal
 * const proposal = await treasury.createPaymentProposal({
 *   title: 'Developer Grant',
 *   recipient: recipientMetaAddress,
 *   token: getStablecoin('USDC', 'ethereum')!,
 *   amount: 10000_000000n, // 10,000 USDC
 *   purpose: 'salary',
 * })
 *
 * // Sign the proposal
 * await treasury.signProposal(proposal.proposalId, signerPrivateKey)
 *
 * // Execute when approved
 * const payments = await treasury.executeProposal(proposal.proposalId)
 * ```
 */

import {
  ProposalStatus,
  PrivacyLevel,
  type TreasuryConfig,
  type TreasuryMember,
  type TreasuryProposal,
  type TreasuryBalance,
  type TreasuryTransaction,
  type CreateTreasuryParams,
  type CreatePaymentProposalParams,
  type CreateBatchProposalParams,
  type BatchPaymentRecipient,
  type ProposalSignature,
  type AuditorViewingKey,
  type Asset,
  type ChainId,
  type HexString,
  type ViewingKey,
  type ShieldedPayment,
} from '@sip-protocol/types'
import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils'

import { ValidationError, ErrorCode } from '../errors'
import { isValidChainId } from '../validation'
import { generateViewingKey, deriveViewingKey } from '../privacy'
import { createShieldedPayment, PaymentBuilder } from '../payment'
import { secureWipe } from '../secure-memory'

/**
 * Default proposal TTL (7 days)
 */
const DEFAULT_PROPOSAL_TTL = 7 * 24 * 60 * 60

/**
 * Treasury class - manages DAO treasury with multi-sig support
 */
export class Treasury {
  private config: TreasuryConfig
  private proposals: Map<string, TreasuryProposal> = new Map()
  private balances: Map<string, TreasuryBalance> = new Map()
  private transactions: TreasuryTransaction[] = []
  private auditorKeys: Map<string, AuditorViewingKey> = new Map()

  private constructor(config: TreasuryConfig) {
    this.config = config
  }

  /**
   * Create a new treasury
   */
  static async create(params: CreateTreasuryParams): Promise<Treasury> {
    // Validate params
    validateCreateTreasuryParams(params)

    const now = Math.floor(Date.now() / 1000)

    // Generate treasury ID
    const treasuryId = generateTreasuryId()

    // Generate master viewing key
    const masterViewingKey = generateViewingKey(`treasury/${treasuryId}`)

    // Build config
    const config: TreasuryConfig = {
      treasuryId,
      name: params.name,
      description: params.description,
      chain: params.chain,
      signingThreshold: params.signingThreshold,
      totalSigners: params.members.filter(m => m.role === 'signer' || m.role === 'owner' || m.role === 'admin').length,
      members: params.members.map(m => ({
        ...m,
        addedAt: now,
      })),
      defaultPrivacy: params.defaultPrivacy ?? PrivacyLevel.SHIELDED,
      masterViewingKey,
      dailyLimit: params.dailyLimit,
      transactionLimit: params.transactionLimit,
      createdAt: now,
      updatedAt: now,
    }

    return new Treasury(config)
  }

  /**
   * Load a treasury from config
   */
  static fromConfig(config: TreasuryConfig): Treasury {
    return new Treasury(config)
  }

  // ─── Getters ─────────────────────────────────────────────────────────────────

  get treasuryId(): string {
    return this.config.treasuryId
  }

  get name(): string {
    return this.config.name
  }

  get chain(): ChainId {
    return this.config.chain
  }

  get signingThreshold(): number {
    return this.config.signingThreshold
  }

  get members(): TreasuryMember[] {
    return [...this.config.members]
  }

  get masterViewingKey(): ViewingKey | undefined {
    return this.config.masterViewingKey
  }

  /**
   * Get treasury configuration
   */
  getConfig(): TreasuryConfig {
    return { ...this.config }
  }

  // ─── Member Management ───────────────────────────────────────────────────────

  /**
   * Get a member by address
   */
  getMember(address: string): TreasuryMember | undefined {
    return this.config.members.find(m => m.address.toLowerCase() === address.toLowerCase())
  }

  /**
   * Check if an address is a signer
   */
  isSigner(address: string): boolean {
    const member = this.getMember(address)
    return member !== undefined && ['owner', 'admin', 'signer'].includes(member.role)
  }

  /**
   * Check if an address can create proposals
   */
  canCreateProposal(address: string): boolean {
    const member = this.getMember(address)
    return member !== undefined && ['owner', 'admin', 'signer'].includes(member.role)
  }

  /**
   * Get all signers
   */
  getSigners(): TreasuryMember[] {
    return this.config.members.filter(m => ['owner', 'admin', 'signer'].includes(m.role))
  }

  // ─── Proposal Management ─────────────────────────────────────────────────────

  /**
   * Create a single payment proposal
   */
  async createPaymentProposal(params: CreatePaymentProposalParams): Promise<TreasuryProposal> {
    validatePaymentProposalParams(params, this.config)

    const now = Math.floor(Date.now() / 1000)
    const proposalId = generateProposalId()

    const proposal: TreasuryProposal = {
      proposalId,
      treasuryId: this.config.treasuryId,
      type: 'payment',
      status: ProposalStatus.PENDING,
      proposer: '', // Should be set by caller
      title: params.title,
      description: params.description,
      createdAt: now,
      expiresAt: now + (params.ttl ?? DEFAULT_PROPOSAL_TTL),
      requiredSignatures: this.config.signingThreshold,
      signatures: [],
      payment: {
        recipient: params.recipient,
        token: params.token,
        amount: params.amount,
        memo: params.memo,
        purpose: params.purpose,
        privacy: params.privacy ?? this.config.defaultPrivacy,
      },
    }

    this.proposals.set(proposalId, proposal)
    return proposal
  }

  /**
   * Create a batch payment proposal
   */
  async createBatchProposal(params: CreateBatchProposalParams): Promise<TreasuryProposal> {
    validateBatchProposalParams(params, this.config)

    const now = Math.floor(Date.now() / 1000)
    const proposalId = generateProposalId()

    // Calculate total amount
    const totalAmount = params.recipients.reduce((sum, r) => sum + r.amount, 0n)

    const proposal: TreasuryProposal = {
      proposalId,
      treasuryId: this.config.treasuryId,
      type: 'batch_payment',
      status: ProposalStatus.PENDING,
      proposer: '',
      title: params.title,
      description: params.description,
      createdAt: now,
      expiresAt: now + (params.ttl ?? DEFAULT_PROPOSAL_TTL),
      requiredSignatures: this.config.signingThreshold,
      signatures: [],
      batchPayment: {
        token: params.token,
        recipients: params.recipients,
        totalAmount,
        privacy: params.privacy ?? this.config.defaultPrivacy,
      },
    }

    this.proposals.set(proposalId, proposal)
    return proposal
  }

  /**
   * Get a proposal by ID
   */
  getProposal(proposalId: string): TreasuryProposal | undefined {
    return this.proposals.get(proposalId)
  }

  /**
   * Get all proposals
   */
  getAllProposals(): TreasuryProposal[] {
    return Array.from(this.proposals.values())
  }

  /**
   * Get pending proposals
   */
  getPendingProposals(): TreasuryProposal[] {
    return this.getAllProposals().filter(p => p.status === ProposalStatus.PENDING)
  }

  /**
   * Sign a proposal
   */
  async signProposal(
    proposalId: string,
    signerAddress: string,
    privateKey: HexString,
    approve: boolean = true,
  ): Promise<TreasuryProposal> {
    const proposal = this.proposals.get(proposalId)
    if (!proposal) {
      throw new ValidationError(
        `proposal not found: ${proposalId}`,
        'proposalId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Validate signer
    if (!this.isSigner(signerAddress)) {
      throw new ValidationError(
        `address is not a signer: ${signerAddress}`,
        'signerAddress',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Check if already signed
    if (proposal.signatures.some(s => s.signer.toLowerCase() === signerAddress.toLowerCase())) {
      throw new ValidationError(
        `signer has already signed this proposal`,
        'signerAddress',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Check proposal status
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new ValidationError(
        `proposal is not pending: ${proposal.status}`,
        'proposalId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (now > proposal.expiresAt) {
      proposal.status = ProposalStatus.EXPIRED
      throw new ValidationError(
        'proposal has expired',
        'proposalId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Create and verify signature
    const messageHash = computeProposalHash(proposal)
    const signature = signMessage(messageHash, privateKey)

    // Verify signature before accepting
    // Get signer's public key from member record
    const signerMember = this.getMember(signerAddress)
    if (signerMember?.publicKey) {
      const isValid = verifySignature(messageHash, signature, signerMember.publicKey)
      if (!isValid) {
        throw new ValidationError(
          'signature verification failed',
          'signature',
          undefined,
          ErrorCode.INVALID_INPUT
        )
      }
    }

    const proposalSignature: ProposalSignature = {
      signer: signerAddress,
      signature,
      signedAt: now,
      approved: approve,
    }

    proposal.signatures.push(proposalSignature)

    // Check if we have enough approvals
    const approvals = proposal.signatures.filter(s => s.approved).length
    const rejections = proposal.signatures.filter(s => !s.approved).length

    if (approvals >= proposal.requiredSignatures) {
      proposal.status = ProposalStatus.APPROVED
    } else if (rejections > this.config.totalSigners - proposal.requiredSignatures) {
      proposal.status = ProposalStatus.REJECTED
    }

    return proposal
  }

  /**
   * Execute an approved proposal
   */
  async executeProposal(proposalId: string): Promise<ShieldedPayment[]> {
    const proposal = this.proposals.get(proposalId)
    if (!proposal) {
      throw new ValidationError(
        `proposal not found: ${proposalId}`,
        'proposalId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    if (proposal.status !== ProposalStatus.APPROVED) {
      throw new ValidationError(
        `proposal is not approved: ${proposal.status}`,
        'proposalId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    const payments: ShieldedPayment[] = []

    if (proposal.type === 'payment' && proposal.payment) {
      // Execute single payment
      const payment = await createShieldedPayment({
        token: proposal.payment.token,
        amount: proposal.payment.amount,
        recipientMetaAddress: proposal.payment.privacy !== PrivacyLevel.TRANSPARENT
          ? proposal.payment.recipient
          : undefined,
        recipientAddress: proposal.payment.privacy === PrivacyLevel.TRANSPARENT
          ? proposal.payment.recipient
          : undefined,
        privacy: proposal.payment.privacy,
        viewingKey: this.config.masterViewingKey?.key,
        sourceChain: this.config.chain,
        purpose: proposal.payment.purpose,
        memo: proposal.payment.memo,
      })
      payments.push(payment)
    } else if (proposal.type === 'batch_payment' && proposal.batchPayment) {
      // Execute batch payments
      for (const recipient of proposal.batchPayment.recipients) {
        const payment = await createShieldedPayment({
          token: proposal.batchPayment.token,
          amount: recipient.amount,
          recipientMetaAddress: proposal.batchPayment.privacy !== PrivacyLevel.TRANSPARENT
            ? recipient.address
            : undefined,
          recipientAddress: proposal.batchPayment.privacy === PrivacyLevel.TRANSPARENT
            ? recipient.address
            : undefined,
          privacy: proposal.batchPayment.privacy,
          viewingKey: this.config.masterViewingKey?.key,
          sourceChain: this.config.chain,
          purpose: recipient.purpose,
          memo: recipient.memo,
        })
        payments.push(payment)
      }
    }

    // Update proposal
    proposal.status = ProposalStatus.EXECUTED
    proposal.executedAt = Math.floor(Date.now() / 1000)
    proposal.resultPayments = payments

    return payments
  }

  /**
   * Cancel a proposal (only by proposer or owner)
   */
  cancelProposal(proposalId: string, cancellerAddress: string): TreasuryProposal {
    const proposal = this.proposals.get(proposalId)
    if (!proposal) {
      throw new ValidationError(
        `proposal not found: ${proposalId}`,
        'proposalId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Only proposer or owner can cancel
    const member = this.getMember(cancellerAddress)
    const isProposer = proposal.proposer.toLowerCase() === cancellerAddress.toLowerCase()
    const isOwner = member?.role === 'owner'

    if (!isProposer && !isOwner) {
      throw new ValidationError(
        'only proposer or owner can cancel proposals',
        'cancellerAddress',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    if (proposal.status !== ProposalStatus.PENDING) {
      throw new ValidationError(
        `proposal is not pending: ${proposal.status}`,
        'proposalId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    proposal.status = ProposalStatus.CANCELLED
    return proposal
  }

  // ─── Auditor Access ──────────────────────────────────────────────────────────

  /**
   * Grant viewing access to an auditor
   */
  grantAuditorAccess(
    auditorId: string,
    auditorName: string,
    granterAddress: string,
    scope: 'all' | 'inbound' | 'outbound' = 'all',
    validUntil?: number,
  ): AuditorViewingKey {
    // Only owners can grant auditor access
    const member = this.getMember(granterAddress)
    if (!member || member.role !== 'owner') {
      throw new ValidationError(
        'only owners can grant auditor access',
        'granterAddress',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    if (!this.config.masterViewingKey) {
      throw new ValidationError(
        'treasury has no master viewing key',
        'masterViewingKey',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Derive auditor-specific viewing key
    const viewingKey = deriveViewingKey(
      this.config.masterViewingKey,
      `auditor/${auditorId}`
    )

    const auditorKey: AuditorViewingKey = {
      auditorId,
      name: auditorName,
      viewingKey,
      scope,
      validFrom: Math.floor(Date.now() / 1000),
      validUntil,
      grantedBy: granterAddress,
      grantedAt: Math.floor(Date.now() / 1000),
    }

    this.auditorKeys.set(auditorId, auditorKey)
    return auditorKey
  }

  /**
   * Revoke auditor access
   */
  revokeAuditorAccess(auditorId: string, revokerAddress: string): boolean {
    const member = this.getMember(revokerAddress)
    if (!member || member.role !== 'owner') {
      throw new ValidationError(
        'only owners can revoke auditor access',
        'revokerAddress',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    return this.auditorKeys.delete(auditorId)
  }

  /**
   * Get all auditor keys
   */
  getAuditorKeys(): AuditorViewingKey[] {
    return Array.from(this.auditorKeys.values())
  }

  // ─── Balance Management ──────────────────────────────────────────────────────

  /**
   * Update balance for a token (called after deposits/withdrawals)
   */
  updateBalance(token: Asset, balance: bigint): void {
    const key = `${token.chain}:${token.symbol}`
    const committed = this.getCommittedAmount(token)

    this.balances.set(key, {
      token,
      balance,
      committed,
      available: balance - committed,
      updatedAt: Math.floor(Date.now() / 1000),
    })
  }

  /**
   * Get balance for a token
   */
  getBalance(token: Asset): TreasuryBalance | undefined {
    const key = `${token.chain}:${token.symbol}`
    return this.balances.get(key)
  }

  /**
   * Get all balances
   */
  getAllBalances(): TreasuryBalance[] {
    return Array.from(this.balances.values())
  }

  /**
   * Get committed amount for pending proposals
   */
  private getCommittedAmount(token: Asset): bigint {
    let committed = 0n

    for (const proposal of this.proposals.values()) {
      if (proposal.status !== ProposalStatus.PENDING) continue

      if (proposal.type === 'payment' && proposal.payment) {
        if (proposal.payment.token.symbol === token.symbol &&
            proposal.payment.token.chain === token.chain) {
          committed += proposal.payment.amount
        }
      } else if (proposal.type === 'batch_payment' && proposal.batchPayment) {
        if (proposal.batchPayment.token.symbol === token.symbol &&
            proposal.batchPayment.token.chain === token.chain) {
          committed += proposal.batchPayment.totalAmount
        }
      }
    }

    return committed
  }

  // ─── Serialization ───────────────────────────────────────────────────────────

  /**
   * Serialize treasury to JSON
   */
  toJSON(): string {
    return JSON.stringify({
      config: this.config,
      proposals: Array.from(this.proposals.entries()),
      balances: Array.from(this.balances.entries()),
      auditorKeys: Array.from(this.auditorKeys.entries()),
    }, (_, value) => typeof value === 'bigint' ? value.toString() : value)
  }

  /**
   * Deserialize treasury from JSON
   */
  static fromJSON(json: string): Treasury {
    const data = JSON.parse(json, (key, value) => {
      // Convert string numbers back to bigint for known fields
      if (typeof value === 'string' && /^\d+$/.test(value) &&
          ['amount', 'totalAmount', 'balance', 'committed', 'available',
           'dailyLimit', 'transactionLimit'].includes(key)) {
        return BigInt(value)
      }
      return value
    })

    const treasury = new Treasury(data.config)
    treasury.proposals = new Map(data.proposals)
    treasury.balances = new Map(data.balances)
    treasury.auditorKeys = new Map(data.auditorKeys)

    return treasury
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function generateTreasuryId(): string {
  const bytes = randomBytes(16)
  return `treasury_${bytesToHex(bytes)}`
}

function generateProposalId(): string {
  const bytes = randomBytes(16)
  return `prop_${bytesToHex(bytes)}`
}

function computeProposalHash(proposal: TreasuryProposal): Uint8Array {
  const data = JSON.stringify({
    proposalId: proposal.proposalId,
    treasuryId: proposal.treasuryId,
    type: proposal.type,
    payment: proposal.payment,
    batchPayment: proposal.batchPayment,
    createdAt: proposal.createdAt,
    expiresAt: proposal.expiresAt,
  }, (_, value) => typeof value === 'bigint' ? value.toString() : value)

  return sha256(new TextEncoder().encode(data))
}

function signMessage(messageHash: Uint8Array, privateKey: HexString): HexString {
  const keyHex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey
  const keyBytes = hexToBytes(keyHex)

  try {
    const signature = secp256k1.sign(messageHash, keyBytes)
    return `0x${signature.toCompactHex()}` as HexString
  } finally {
    secureWipe(keyBytes)
  }
}

function verifySignature(
  messageHash: Uint8Array,
  signature: HexString,
  publicKey: HexString,
): boolean {
  const sigHex = signature.startsWith('0x') ? signature.slice(2) : signature
  const pubKeyHex = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey

  try {
    // Convert compact signature to secp256k1 Signature
    const sig = secp256k1.Signature.fromCompact(sigHex)
    const pubKeyBytes = hexToBytes(pubKeyHex)

    return secp256k1.verify(sig, messageHash, pubKeyBytes)
  } catch {
    return false
  }
}

function validateCreateTreasuryParams(params: CreateTreasuryParams): void {
  if (!params.name || params.name.trim().length === 0) {
    throw new ValidationError(
      'treasury name is required',
      'name',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }

  if (!isValidChainId(params.chain)) {
    throw new ValidationError(
      `invalid chain: ${params.chain}`,
      'chain',
      undefined,
      ErrorCode.INVALID_INPUT
    )
  }

  if (!params.members || params.members.length === 0) {
    throw new ValidationError(
      'at least one member is required',
      'members',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }

  // Check for at least one owner
  const hasOwner = params.members.some(m => m.role === 'owner')
  if (!hasOwner) {
    throw new ValidationError(
      'at least one owner is required',
      'members',
      undefined,
      ErrorCode.INVALID_INPUT
    )
  }

  // Count signers
  const signerCount = params.members.filter(m =>
    ['owner', 'admin', 'signer'].includes(m.role)
  ).length

  if (params.signingThreshold < 1) {
    throw new ValidationError(
      'signing threshold must be at least 1',
      'signingThreshold',
      undefined,
      ErrorCode.INVALID_INPUT
    )
  }

  if (params.signingThreshold > signerCount) {
    throw new ValidationError(
      `signing threshold (${params.signingThreshold}) cannot exceed number of signers (${signerCount})`,
      'signingThreshold',
      undefined,
      ErrorCode.INVALID_INPUT
    )
  }
}

function validatePaymentProposalParams(
  params: CreatePaymentProposalParams,
  config: TreasuryConfig,
): void {
  if (!params.title || params.title.trim().length === 0) {
    throw new ValidationError(
      'proposal title is required',
      'title',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }

  if (!params.recipient || params.recipient.trim().length === 0) {
    throw new ValidationError(
      'recipient is required',
      'recipient',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }

  if (!params.token) {
    throw new ValidationError(
      'token is required',
      'token',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }

  if (params.amount <= 0n) {
    throw new ValidationError(
      'amount must be positive',
      'amount',
      undefined,
      ErrorCode.INVALID_INPUT
    )
  }

  // Check transaction limit
  if (config.transactionLimit && params.amount > config.transactionLimit) {
    throw new ValidationError(
      `amount exceeds transaction limit (${config.transactionLimit})`,
      'amount',
      undefined,
      ErrorCode.INVALID_INPUT
    )
  }
}

function validateBatchProposalParams(
  params: CreateBatchProposalParams,
  config: TreasuryConfig,
): void {
  if (!params.title || params.title.trim().length === 0) {
    throw new ValidationError(
      'proposal title is required',
      'title',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }

  if (!params.recipients || params.recipients.length === 0) {
    throw new ValidationError(
      'at least one recipient is required',
      'recipients',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }

  if (!params.token) {
    throw new ValidationError(
      'token is required',
      'token',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }

  // Validate each recipient
  for (let i = 0; i < params.recipients.length; i++) {
    const r = params.recipients[i]
    if (!r.address || r.address.trim().length === 0) {
      throw new ValidationError(
        `recipient ${i} address is required`,
        `recipients[${i}].address`,
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }
    if (r.amount <= 0n) {
      throw new ValidationError(
        `recipient ${i} amount must be positive`,
        `recipients[${i}].amount`,
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }
  }

  // Check total against transaction limit
  const total = params.recipients.reduce((sum, r) => sum + r.amount, 0n)
  if (config.transactionLimit && total > config.transactionLimit) {
    throw new ValidationError(
      `total amount (${total}) exceeds transaction limit (${config.transactionLimit})`,
      'recipients',
      undefined,
      ErrorCode.INVALID_INPUT
    )
  }
}
