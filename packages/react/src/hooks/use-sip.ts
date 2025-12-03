import { useState, useCallback, useContext } from 'react'
import { SIP, type SIPConfig } from '@sip-protocol/sdk'
import { useSIPContext } from '../providers/sip-provider'

/**
 * Return type for useSIP hook
 */
export interface UseSIPReturn {
  /** SIP client instance (null if not initialized or no provider) */
  client: SIP | null
  /** Whether the client is ready to use */
  isReady: boolean
  /** Error during initialization (if any) */
  error: Error | null
  /** Manually initialize the SIP client (only for standalone usage) */
  initialize: (config: SIPConfig) => Promise<void>
}

/**
 * useSIP - Main hook for accessing SIP client
 *
 * Provides access to the SIP client instance from SIPProvider, along with
 * initialization state and error handling. Can also be used standalone without
 * a provider by calling `initialize()`.
 *
 * **Usage with SIPProvider (recommended):**
 * ```tsx
 * import { SIPProvider, useSIP } from '@sip-protocol/react'
 *
 * function App() {
 *   return (
 *     <SIPProvider config={{ network: 'testnet' }}>
 *       <MyComponent />
 *     </SIPProvider>
 *   )
 * }
 *
 * function MyComponent() {
 *   const { client, isReady } = useSIP()
 *
 *   if (!isReady || !client) {
 *     return <div>Loading...</div>
 *   }
 *
 *   // Use client.createIntent(), client.getQuotes(), etc.
 * }
 * ```
 *
 * **Standalone usage (without provider):**
 * ```tsx
 * function MyComponent() {
 *   const { client, isReady, initialize, error } = useSIP()
 *
 *   useEffect(() => {
 *     initialize({ network: 'testnet' }).catch(console.error)
 *   }, [])
 *
 *   if (error) {
 *     return <div>Error: {error.message}</div>
 *   }
 *
 *   if (!isReady || !client) {
 *     return <div>Initializing...</div>
 *   }
 *
 *   return <div>Ready!</div>
 * }
 * ```
 *
 * @returns Object with client, isReady, error, and initialize function
 *
 * @example Basic usage with provider
 * ```tsx
 * import { useSIP } from '@sip-protocol/react'
 *
 * function MyComponent() {
 *   const { client, isReady } = useSIP()
 *
 *   if (!isReady || !client) {
 *     return <div>Loading...</div>
 *   }
 *
 *   // Use client methods
 *   const handleCreateIntent = async () => {
 *     const intent = await client.createIntent({ ... })
 *   }
 * }
 * ```
 *
 * @example With error handling
 * ```tsx
 * function MyComponent() {
 *   const { client, isReady, error } = useSIP()
 *
 *   if (error) {
 *     return <div>Failed to initialize: {error.message}</div>
 *   }
 *
 *   if (!isReady || !client) {
 *     return <div>Initializing SIP client...</div>
 *   }
 *
 *   return <div>Ready to use SIP!</div>
 * }
 * ```
 *
 * @example Standalone initialization
 * ```tsx
 * function MyComponent() {
 *   const { client, isReady, initialize } = useSIP()
 *
 *   const handleInit = async () => {
 *     try {
 *       await initialize({
 *         network: 'mainnet',
 *         mode: 'production',
 *         intentsAdapter: { jwtToken: 'xxx' }
 *       })
 *     } catch (err) {
 *       console.error('Init failed:', err)
 *     }
 *   }
 *
 *   return (
 *     <button onClick={handleInit} disabled={isReady}>
 *       {isReady ? 'Initialized' : 'Initialize SIP'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useSIP(): UseSIPReturn {
  // State for standalone usage (without provider)
  const [standaloneClient, setStandaloneClient] = useState<SIP | null>(null)
  const [standaloneReady, setStandaloneReady] = useState(false)
  const [standaloneError, setStandaloneError] = useState<Error | null>(null)

  // Try to get context from SIPProvider
  let providerContext
  try {
    providerContext = useSIPContext()
  } catch {
    // Not inside SIPProvider, use standalone mode
    providerContext = null
  }

  const standaloneInitialize = useCallback(async (config: SIPConfig) => {
    // Prevent re-initialization if already initialized
    if (standaloneClient && standaloneReady) {
      console.warn('SIP client already initialized. Call will be ignored.')
      return
    }

    try {
      setStandaloneError(null)
      setStandaloneReady(false)

      const newClient = new SIP(config)
      setStandaloneClient(newClient)
      setStandaloneReady(true)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setStandaloneError(error)
      setStandaloneReady(false)
      throw error
    }
  }, [standaloneClient, standaloneReady])

  // If we have a provider context, use it
  if (providerContext) {
    return {
      client: providerContext.client,
      isReady: true, // Provider always provides ready client
      error: null, // Provider throws on error, doesn't expose it
      initialize: async () => {
        console.warn('initialize() called but SIPProvider is already providing a client. This call will be ignored.')
      },
    }
  }

  // Otherwise, return standalone state
  return {
    client: standaloneClient,
    isReady: standaloneReady,
    error: standaloneError,
    initialize: standaloneInitialize,
  }
}
