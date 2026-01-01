import Conf from 'conf'
import type { ChainId, PrivacyLevel } from '@sip-protocol/types'

export interface SIPConfig {
  network: 'mainnet' | 'testnet'
  defaultPrivacy: PrivacyLevel
  defaultChain?: ChainId
  primaryChain?: ChainId
  metaAddress?: string
  viewingKeys?: Record<string, string>
  rpcEndpoints?: Record<string, string>
}

type ConfigKey = keyof SIPConfig

const store = new Conf<Record<string, unknown>>({
  projectName: 'sip-protocol',
  defaults: {
    network: 'testnet',
    defaultPrivacy: 'transparent',
  },
})

export function getConfig(key: ConfigKey): unknown
export function getConfig(): SIPConfig
export function getConfig(key?: ConfigKey): SIPConfig | unknown {
  if (key) {
    return store.get(key)
  }
  return {
    network: store.get('network') as 'mainnet' | 'testnet',
    defaultPrivacy: store.get('defaultPrivacy') as PrivacyLevel,
    defaultChain: store.get('defaultChain') as ChainId | undefined,
    primaryChain: store.get('primaryChain') as ChainId | undefined,
    metaAddress: store.get('metaAddress') as string | undefined,
    viewingKeys: store.get('viewingKeys') as Record<string, string> | undefined,
    rpcEndpoints: store.get('rpcEndpoints') as Record<string, string> | undefined,
  }
}

export function setConfig(key: ConfigKey, value: unknown): void {
  store.set(key, value)
}

export function resetConfig(): void {
  store.clear()
}

export function getConfigPath(): string {
  return store.path
}
