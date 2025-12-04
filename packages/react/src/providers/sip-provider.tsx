import React, { createContext, useContext, useMemo, type ReactNode } from 'react'
import { SIP, type SIPConfig } from '@sip-protocol/sdk'

interface SIPContextValue {
  client: SIP
  config: SIPConfig
}

const SIPContext = createContext<SIPContextValue | undefined>(undefined)

export interface SIPProviderProps {
  config: SIPConfig
  children: ReactNode
}

/**
 * SIPProvider wraps your app and provides SIP client instance via context
 *
 * @example
 * ```tsx
 * import { SIPProvider } from '@sip-protocol/react'
 *
 * function App() {
 *   return (
 *     <SIPProvider config={{ nearIntents: { apiUrl: '...' } }}>
 *       <YourApp />
 *     </SIPProvider>
 *   )
 * }
 * ```
 */
export function SIPProvider({ config, children }: SIPProviderProps) {
  const client = useMemo(() => new SIP(config), [config])

  const value = useMemo(() => ({ client, config }), [client, config])

  return <SIPContext.Provider value={value}>{children}</SIPContext.Provider>
}

/**
 * useSIPContext - Internal hook to access SIP context
 * @internal
 */
export function useSIPContext(): SIPContextValue {
  const context = useContext(SIPContext)
  if (!context) {
    throw new Error('useSIPContext must be used within SIPProvider')
  }
  return context
}
