import Conf from 'conf'
import type { ChainId, PrivacyLevel } from '@sip-protocol/types'

export interface SIPConfig {
  network: 'mainnet' | 'testnet'
  defaultPrivacy: PrivacyLevel
  defaultChain?: ChainId
  rpcEndpoints?: Record<string, string>
}

const schema = {
  network: {
    type: 'string',
    default: 'testnet',
  },
  defaultPrivacy: {
    type: 'string',
    default: 'transparent',
  },
} as const

const store = new Conf({
  projectName: 'sip-protocol',
  schema,
})

export function getConfig(): SIPConfig {
  return {
    network: store.get('network') as 'mainnet' | 'testnet',
    defaultPrivacy: store.get('defaultPrivacy') as PrivacyLevel,
    defaultChain: store.get('defaultChain') as ChainId | undefined,
    rpcEndpoints: store.get('rpcEndpoints') as Record<string, string> | undefined,
  }
}

export function setConfig(key: keyof SIPConfig, value: unknown): void {
  store.set(key, value)
}

export function resetConfig(): void {
  store.clear()
}

export function getConfigPath(): string {
  return store.path
}
