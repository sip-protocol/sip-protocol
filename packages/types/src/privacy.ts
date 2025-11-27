/**
 * Privacy level for SIP transactions
 *
 * - transparent: Standard intent with no privacy (equivalent to current NEAR Intents)
 * - shielded: Full privacy via Zcash shielded pool
 * - compliant: Shielded mode with viewing key for selective disclosure
 */
export enum PrivacyLevel {
  /** Standard public transaction - no privacy guarantees */
  TRANSPARENT = 'transparent',
  /** Full privacy via Zcash shielded pool */
  SHIELDED = 'shielded',
  /** Privacy with viewing key for compliance/audit */
  COMPLIANT = 'compliant',
}

/**
 * Check if a privacy level provides on-chain privacy
 */
export function isPrivate(level: PrivacyLevel): boolean {
  return level === PrivacyLevel.SHIELDED || level === PrivacyLevel.COMPLIANT
}

/**
 * Check if a privacy level supports viewing keys
 */
export function supportsViewingKey(level: PrivacyLevel): boolean {
  return level === PrivacyLevel.COMPLIANT
}
