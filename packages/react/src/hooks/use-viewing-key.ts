import { useState, useCallback } from 'react'
import type { ViewingKey, EncryptedTransaction } from '@sip-protocol/types'
import {
  generateViewingKey as sdkGenerateViewingKey,
  decryptWithViewing,
} from '@sip-protocol/sdk'

/**
 * Auditor share entry
 */
interface AuditorShare {
  auditorId: string
  viewingKeyHash: string
  sharedAt: number
}

/**
 * useViewingKey - Generate and manage viewing keys for compliance
 *
 * @remarks
 * Hook for managing viewing keys that enable selective disclosure of transaction
 * details to auditors or regulators while maintaining on-chain privacy.
 *
 * Features:
 * - Generate cryptographically random viewing keys
 * - Decrypt encrypted transaction data
 * - Share viewing keys with auditors (tracked in state)
 * - Hierarchical key derivation via path parameter
 *
 * @example Basic usage
 * ```tsx
 * import { useViewingKey } from '@sip-protocol/react'
 *
 * function CompliancePanel() {
 *   const { viewingKey, generate, decrypt, share } = useViewingKey()
 *
 *   const handleGenerateKey = () => {
 *     const key = generate('m/0/audit')
 *     console.log('Generated viewing key:', key.hash)
 *   }
 *
 *   const handleDecrypt = async (encrypted: EncryptedTransaction) => {
 *     try {
 *       const data = await decrypt(encrypted)
 *       console.log('Decrypted amount:', data.amount)
 *     } catch (e) {
 *       console.error('Decryption failed - wrong key')
 *     }
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleGenerateKey}>Generate Key</button>
 *       {viewingKey && <p>Key hash: {viewingKey.hash}</p>}
 *     </div>
 *   )
 * }
 * ```
 *
 * @example Sharing with auditors
 * ```tsx
 * function AuditManager() {
 *   const { viewingKey, generate, share, sharedWith } = useViewingKey()
 *
 *   useEffect(() => {
 *     generate('m/0/compliance')
 *   }, [])
 *
 *   const handleShareWithAuditor = async () => {
 *     await share('auditor-123')
 *     console.log('Shared with:', sharedWith)
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleShareWithAuditor}>Share with Auditor</button>
 *       <ul>
 *         {sharedWith.map(audit => (
 *           <li key={audit.auditorId}>{audit.auditorId}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   )
 * }
 * ```
 */
export function useViewingKey() {
  const [viewingKey, setViewingKey] = useState<ViewingKey | null>(null)
  const [sharedWith, setSharedWith] = useState<AuditorShare[]>([])

  /**
   * Generate a new viewing key
   *
   * @param path - Hierarchical derivation path (BIP32-style, defaults to 'm/0')
   * @returns Generated viewing key
   *
   * @example
   * ```tsx
   * const key = generate('m/0/audit')
   * console.log(key.hash) // "0xabc123..."
   * ```
   */
  const generate = useCallback((path?: string): ViewingKey => {
    const key = sdkGenerateViewingKey(path)
    setViewingKey(key)
    setSharedWith([]) // Reset shares when generating new key
    return key
  }, [])

  /**
   * Decrypt encrypted transaction data with the current viewing key
   *
   * @param encrypted - Encrypted transaction data
   * @returns Promise resolving to decrypted transaction details
   * @throws {Error} If no viewing key is set or decryption fails
   *
   * @example
   * ```tsx
   * const data = await decrypt(encryptedTransaction)
   * console.log(`Sender: ${data.sender}`)
   * console.log(`Amount: ${data.amount}`)
   * ```
   */
  const decrypt = useCallback(
    async (encrypted: EncryptedTransaction) => {
      if (!viewingKey) {
        throw new Error('No viewing key available. Call generate() first.')
      }

      return decryptWithViewing(encrypted, viewingKey)
    },
    [viewingKey],
  )

  /**
   * Share viewing key with an auditor (tracked in state)
   *
   * @param auditorId - Unique identifier for the auditor
   * @returns Promise that resolves when sharing is complete
   * @throws {Error} If no viewing key is set
   *
   * @remarks
   * This function tracks which auditors have been given access to the viewing key.
   * In a production system, you would:
   * - Encrypt the viewing key with the auditor's public key
   * - Store the encrypted key in a database or smart contract
   * - Send the encrypted key to the auditor via secure channel
   *
   * @example
   * ```tsx
   * await share('auditor-alice')
   * await share('auditor-bob')
   * console.log(sharedWith) // [{ auditorId: 'auditor-alice', ... }, ...]
   * ```
   */
  const share = useCallback(
    async (auditorId: string): Promise<void> => {
      if (!viewingKey) {
        throw new Error('No viewing key available. Call generate() first.')
      }

      const shareEntry: AuditorShare = {
        auditorId,
        viewingKeyHash: viewingKey.hash,
        sharedAt: Date.now(),
      }

      setSharedWith(prev => [...prev, shareEntry])

      // In a real implementation:
      // 1. Encrypt viewing key with auditor's public key
      // 2. Store encrypted key on-chain or in secure database
      // 3. Notify auditor via secure channel
    },
    [viewingKey],
  )

  return {
    /** Current viewing key (null if not generated) */
    viewingKey,
    /** List of auditors who have been given access */
    sharedWith,
    /** Generate a new viewing key */
    generate,
    /** Decrypt encrypted transaction data */
    decrypt,
    /** Share viewing key with an auditor */
    share,
  }
}
