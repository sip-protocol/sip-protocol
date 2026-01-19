/**
 * Ethereum Viewing Key Manager
 *
 * Preset configuration for managing Ethereum viewing keys.
 *
 * @module components/ethereum/viewing-key-manager
 */

import React, { useCallback } from 'react'
import {
  ViewingKeyManager,
  useViewingKeyManager,
  type ViewingKeyManagerProps,
  type ViewingKey,
  type KeyExportFormat,
  type KeyImportSource,
} from '../viewing-key-manager'

/**
 * Ethereum-specific viewing key data
 */
export interface EthereumViewingKey extends ViewingKey {
  /** Chain ID the key is associated with */
  chainId?: number
  /** Stealth meta-address associated with this key */
  stealthMetaAddress?: string
}

/**
 * EthereumViewingKeyManager props
 */
export interface EthereumViewingKeyManagerProps
  extends Omit<ViewingKeyManagerProps, 'keys' | 'onGenerateKey' | 'onExportKey' | 'onImportKey' | 'onShareKey' | 'onRevokeKey'> {
  /** List of Ethereum viewing keys */
  keys: EthereumViewingKey[]
  /** Callback to generate a new key */
  onGenerateKey?: (label?: string, chainId?: number) => Promise<EthereumViewingKey>
  /** Callback to export a key */
  onExportKey?: (keyId: string, format: KeyExportFormat, password?: string) => Promise<string | Blob>
  /** Callback to import a key */
  onImportKey?: (source: KeyImportSource, data: string | File) => Promise<EthereumViewingKey>
  /** Callback to share a key */
  onShareKey?: (keyId: string, recipient: string) => Promise<void>
  /** Callback to revoke a key */
  onRevokeKey?: (keyId: string) => Promise<void>
  /** Default chain ID for new keys */
  defaultChainId?: number
}

/**
 * EthereumViewingKeyManager - Ethereum-configured viewing key manager
 *
 * @example Basic usage
 * ```tsx
 * import { EthereumViewingKeyManager } from '@sip-protocol/react'
 *
 * function KeyManagement() {
 *   const [keys, setKeys] = useState<EthereumViewingKey[]>([])
 *
 *   return (
 *     <EthereumViewingKeyManager
 *       keys={keys}
 *       onGenerateKey={async (label, chainId) => {
 *         const key = await generateEthereumViewingKey(label, chainId)
 *         setKeys([...keys, key])
 *         return key
 *       }}
 *     />
 *   )
 * }
 * ```
 */
export function EthereumViewingKeyManager({
  keys,
  onGenerateKey,
  onExportKey,
  onImportKey,
  onShareKey,
  onRevokeKey,
  defaultChainId = 1,
  ...props
}: EthereumViewingKeyManagerProps) {
  // Wrap the generate callback to include chain ID
  const handleGenerateKey = useCallback(
    async (label?: string) => {
      if (!onGenerateKey) {
        throw new Error('onGenerateKey not provided')
      }
      return onGenerateKey(label, defaultChainId)
    },
    [onGenerateKey, defaultChainId]
  )

  // Cast handlers to match base interface
  const handleExportKey = useCallback(
    async (keyId: string, format: KeyExportFormat, password?: string) => {
      if (!onExportKey) {
        throw new Error('onExportKey not provided')
      }
      return onExportKey(keyId, format, password)
    },
    [onExportKey]
  )

  const handleImportKey = useCallback(
    async (source: KeyImportSource, data: string | File) => {
      if (!onImportKey) {
        throw new Error('onImportKey not provided')
      }
      return onImportKey(source, data)
    },
    [onImportKey]
  )

  return (
    <ViewingKeyManager
      keys={keys}
      onGenerateKey={onGenerateKey ? handleGenerateKey : undefined}
      onExportKey={onExportKey ? handleExportKey : undefined}
      onImportKey={onImportKey ? handleImportKey : undefined}
      onShareKey={onShareKey}
      onRevokeKey={onRevokeKey}
      {...props}
    />
  )
}

/**
 * Hook for managing Ethereum viewing keys
 *
 * @example
 * ```tsx
 * const {
 *   keys,
 *   activeKeys,
 *   generateKey,
 *   exportKey,
 *   revokeKey,
 * } = useEthereumViewingKey({
 *   chainId: 1,
 *   onKeyGenerated: (key) => console.log('Generated:', key),
 * })
 * ```
 */
export function useEthereumViewingKey(options: {
  chainId?: number
  initialKeys?: EthereumViewingKey[]
  onKeyGenerated?: (key: EthereumViewingKey) => void
  onKeyRevoked?: (keyId: string) => void
} = {}) {
  const { chainId = 1, initialKeys = [], onKeyGenerated, onKeyRevoked } = options

  // Use base hook
  const baseHook = useViewingKeyManager(initialKeys)

  // Generate Ethereum-specific key (mock implementation - real would use SDK)
  const generateKey = useCallback(
    async (label?: string): Promise<EthereumViewingKey> => {
      // Generate a mock key - in real usage, this would call the SDK
      const id = `vk_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const publicKey = `0x${Array(64)
        .fill(0)
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('')}`
      const privateKey = `0x${Array(64)
        .fill(0)
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('')}`

      const key: EthereumViewingKey = {
        id,
        publicKey,
        privateKey,
        label: label || `Ethereum Key ${baseHook.keys.length + 1}`,
        status: 'active',
        createdAt: Date.now(),
        usageHistory: [{ timestamp: Date.now(), action: 'created' }],
        chainId,
      }

      baseHook.addKey(key)
      onKeyGenerated?.(key)

      return key
    },
    [baseHook, chainId, onKeyGenerated]
  )

  // Revoke key with callback
  const revokeKey = useCallback(
    (keyId: string) => {
      baseHook.revokeKey(keyId)
      onKeyRevoked?.(keyId)
    },
    [baseHook, onKeyRevoked]
  )

  // Get keys for specific chain
  const keysForChain = useCallback(
    (targetChainId: number) => {
      return (baseHook.keys as EthereumViewingKey[]).filter(
        (k) => k.chainId === targetChainId || !k.chainId
      )
    },
    [baseHook.keys]
  )

  // Format viewing key for display
  const formatViewingKeyAddress = useCallback((key: EthereumViewingKey) => {
    const pk = key.publicKey
    if (pk.length <= 16) return pk
    return `${pk.slice(0, 10)}...${pk.slice(-8)}`
  }, [])

  return {
    ...baseHook,
    keys: baseHook.keys as EthereumViewingKey[],
    activeKeys: baseHook.activeKeys as EthereumViewingKey[],
    revokedKeys: baseHook.revokedKeys as EthereumViewingKey[],
    generateKey,
    revokeKey,
    keysForChain,
    formatViewingKeyAddress,
    currentChainId: chainId,
  }
}

export default EthereumViewingKeyManager
