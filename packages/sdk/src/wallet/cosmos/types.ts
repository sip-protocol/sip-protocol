/**
 * Cosmos Wallet Types
 *
 * Type definitions for Cosmos ecosystem wallet integration.
 * Supports Keplr, Leap, and other Cosmos wallets using standard interfaces.
 */

import type { HexString } from '@sip-protocol/types'

/**
 * Cosmos account data interface
 * Represents a Cosmos account with address and public key
 */
export interface CosmosAccountData {
  /** Bech32 encoded address (e.g., cosmos1...) */
  address: string
  /** Algorithm used for key generation (typically secp256k1) */
  algo: 'secp256k1' | 'eth-secp256k1' | 'ed25519'
  /** Public key bytes */
  pubkey: Uint8Array
  /** Whether this is an Ethereum-compatible account (ethermint) */
  isEthermintAccount?: boolean
}

/**
 * Cosmos signature algorithm
 */
export type CosmosAlgo = 'secp256k1' | 'eth-secp256k1' | 'ed25519'

/**
 * Amino sign doc (legacy signing)
 * Used for compatibility with older Cosmos SDK versions
 */
export interface StdSignDoc {
  chain_id: string
  account_number: string
  sequence: string
  fee: StdFee
  msgs: readonly CosmosMsg[]
  memo: string
}

/**
 * Standard fee structure
 */
export interface StdFee {
  amount: readonly Coin[]
  gas: string
  granter?: string
  payer?: string
}

/**
 * Cosmos coin denomination
 */
export interface Coin {
  denom: string
  amount: string
}

/**
 * Generic Cosmos message
 */
export interface CosmosMsg {
  type: string
  value: unknown
}

/**
 * Amino signing response
 */
export interface AminoSignResponse {
  /** Signed document */
  signed: StdSignDoc
  /** Signature */
  signature: StdSignature
}

/**
 * Standard signature
 */
export interface StdSignature {
  pub_key: PubKey
  signature: string // Base64 encoded
}

/**
 * Public key structure
 */
export interface PubKey {
  type: string
  value: string // Base64 encoded
}

/**
 * Direct sign doc (protobuf signing)
 * Used for newer Cosmos SDK versions with protobuf transactions
 */
export interface DirectSignDoc {
  /** Serialized body bytes */
  bodyBytes: Uint8Array
  /** Serialized auth info bytes */
  authInfoBytes: Uint8Array
  /** Chain ID */
  chainId: string
  /** Account number */
  accountNumber: bigint
}

/**
 * Direct signing response
 */
export interface DirectSignResponse {
  /** Signed document */
  signed: DirectSignDoc
  /** Signature bytes */
  signature: StdSignature
}

/**
 * Keplr window interface
 * Injected by Keplr browser extension
 */
export interface Keplr {
  /** Enable connection to a chain */
  enable(chainId: string | string[]): Promise<void>

  /** Get account for a chain */
  getKey(chainId: string): Promise<Key>

  /** Sign using Amino */
  signAmino(
    chainId: string,
    signer: string,
    signDoc: StdSignDoc,
    signOptions?: KeplrSignOptions
  ): Promise<AminoSignResponse>

  /** Sign using Direct (protobuf) */
  signDirect(
    chainId: string,
    signer: string,
    signDoc: {
      bodyBytes?: Uint8Array | null
      authInfoBytes?: Uint8Array | null
      chainId?: string | null
      accountNumber?: bigint | null
    },
    signOptions?: KeplrSignOptions
  ): Promise<DirectSignResponse>

  /** Sign arbitrary data */
  signArbitrary(
    chainId: string,
    signer: string,
    data: string | Uint8Array
  ): Promise<StdSignature>

  /** Verify arbitrary data signature */
  verifyArbitrary(
    chainId: string,
    signer: string,
    data: string | Uint8Array,
    signature: StdSignature
  ): Promise<boolean>

  /** Get offline signer for Amino */
  getOfflineSignerAuto(chainId: string): Promise<OfflineSigner>

  /** Get offline signer only for Amino */
  getOfflineSignerOnlyAmino(chainId: string): Promise<OfflineAminoSigner>

  /** Get offline direct signer */
  getOfflineSigner(chainId: string): Promise<OfflineSigner>

  /** Suggest adding a chain */
  experimentalSuggestChain(chainInfo: ChainInfo): Promise<void>
}

/**
 * Key information from Keplr
 */
export interface Key {
  /** Account name */
  name: string
  /** Algorithm used */
  algo: CosmosAlgo
  /** Public key bytes */
  pubKey: Uint8Array
  /** Bech32 address */
  address: string
  /** Bech32 prefix */
  bech32Address: string
  /** Whether this is a NanoLedger */
  isNanoLedger?: boolean
  /** Whether this is a keystone */
  isKeystone?: boolean
}

/**
 * Keplr signing options
 */
export interface KeplrSignOptions {
  /** Prefer no set fee */
  preferNoSetFee?: boolean
  /** Prefer no set memo */
  preferNoSetMemo?: boolean
  /** Disable balance check */
  disableBalanceCheck?: boolean
}

/**
 * Offline signer interface
 */
export interface OfflineSigner {
  getAccounts(): Promise<readonly CosmosAccountData[]>
  signDirect(signerAddress: string, signDoc: DirectSignDoc): Promise<DirectSignResponse>
}

/**
 * Offline Amino signer interface
 */
export interface OfflineAminoSigner {
  getAccounts(): Promise<readonly CosmosAccountData[]>
  signAmino(signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse>
}

/**
 * Chain info for suggesting chains to Keplr
 */
export interface ChainInfo {
  chainId: string
  chainName: string
  rpc: string
  rest: string
  bip44: {
    coinType: number
  }
  bech32Config: {
    bech32PrefixAccAddr: string
    bech32PrefixAccPub: string
    bech32PrefixValAddr: string
    bech32PrefixValPub: string
    bech32PrefixConsAddr: string
    bech32PrefixConsPub: string
  }
  currencies: Currency[]
  feeCurrencies: Currency[]
  stakeCurrency: Currency
  coinType?: number
  gasPriceStep?: {
    low: number
    average: number
    high: number
  }
}

/**
 * Currency information
 */
export interface Currency {
  coinDenom: string
  coinMinimalDenom: string
  coinDecimals: number
  coinGeckoId?: string
  coinImageUrl?: string
}

/**
 * Cosmos wallet name/type
 */
export type CosmosWalletName = 'keplr' | 'leap' | 'cosmostation' | 'generic'

/**
 * Cosmos chain IDs
 */
export const CosmosChainId = {
  COSMOSHUB: 'cosmoshub-4',
  OSMOSIS: 'osmosis-1',
  JUNO: 'juno-1',
  STARGAZE: 'stargaze-1',
  AKASH: 'akashnet-2',
  // Testnets
  COSMOSHUB_TESTNET: 'theta-testnet-001',
  OSMOSIS_TESTNET: 'osmo-test-5',
} as const

export type CosmosChainIdType = typeof CosmosChainId[keyof typeof CosmosChainId]

/**
 * Cosmos adapter configuration
 */
export interface CosmosAdapterConfig {
  /** Wallet to connect to */
  wallet?: CosmosWalletName
  /** Chain ID to connect to */
  chainId?: string
  /** RPC endpoint URL */
  rpcEndpoint?: string
  /** REST endpoint URL */
  restEndpoint?: string
  /** Custom Keplr provider (for testing) */
  provider?: Keplr
  /** Bech32 address prefix (default: 'cosmos') */
  bech32Prefix?: string
}

/**
 * Cosmos-specific unsigned transaction
 */
export interface CosmosUnsignedTransaction {
  /** Sign doc for Amino signing */
  aminoSignDoc?: StdSignDoc
  /** Sign doc for Direct signing */
  directSignDoc?: DirectSignDoc
  /** Preferred signing method */
  signMethod?: 'amino' | 'direct'
  /** Chain ID */
  chainId: string
  /** Signer address */
  signerAddress?: string
}

/**
 * Extended signature with Cosmos-specific data
 */
export interface CosmosSignature {
  /** Raw signature bytes as hex */
  signature: HexString
  /** Public key as hex */
  publicKey: HexString
  /** Base64 encoded signature (Cosmos standard) */
  base64Signature?: string
  /** Standard signature structure */
  stdSignature?: StdSignature
}

/**
 * Get the injected Cosmos wallet provider
 */
export function getCosmosProvider(wallet: CosmosWalletName = 'keplr'): Keplr | undefined {
  if (typeof window === 'undefined') return undefined

  const win = window as unknown as {
    keplr?: Keplr
    leap?: Keplr
    cosmostation?: { providers?: { keplr?: Keplr } }
  }

  switch (wallet) {
    case 'keplr':
      return win.keplr
    case 'leap':
      return win.leap
    case 'cosmostation':
      return win.cosmostation?.providers?.keplr
    case 'generic':
    default:
      // Try to find any available provider
      return win.keplr ?? win.leap ?? win.cosmostation?.providers?.keplr
  }
}

/**
 * Detect which Cosmos wallets are installed
 */
export function detectCosmosWallets(): CosmosWalletName[] {
  if (typeof window === 'undefined') return []

  const detected: CosmosWalletName[] = []
  const win = window as unknown as {
    keplr?: Keplr
    leap?: Keplr
    cosmostation?: { providers?: { keplr?: Keplr } }
  }

  if (win.keplr) detected.push('keplr')
  if (win.leap) detected.push('leap')
  if (win.cosmostation?.providers?.keplr) detected.push('cosmostation')

  return detected
}

/**
 * Convert Cosmos public key bytes to hex string
 */
export function cosmosPublicKeyToHex(pubkey: Uint8Array): HexString {
  return ('0x' + Buffer.from(pubkey).toString('hex')) as HexString
}

/**
 * Convert bech32 address to hex
 */
export function bech32ToHex(bech32Address: string): HexString {
  // Simple bech32 decoding
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

  const decoded = bech32Address.toLowerCase()
  const pos = decoded.lastIndexOf('1')
  if (pos < 1) throw new Error('Invalid bech32 address')

  const data = decoded.slice(pos + 1)
  const values: number[] = []

  for (const char of data) {
    const value = CHARSET.indexOf(char)
    if (value === -1) throw new Error(`Invalid bech32 character: ${char}`)
    values.push(value)
  }

  // Convert from 5-bit to 8-bit
  const bytes: number[] = []
  let buffer = 0
  let bits = 0

  for (const value of values.slice(0, -6)) {
    buffer = (buffer << 5) | value
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
      buffer &= (1 << bits) - 1
    }
  }

  return ('0x' + Buffer.from(bytes).toString('hex')) as HexString
}

/**
 * Get default RPC endpoint for Cosmos chains
 */
export function getDefaultRpcEndpoint(chainId: string): string {
  const endpoints: Record<string, string> = {
    [CosmosChainId.COSMOSHUB]: 'https://rpc.cosmos.network',
    [CosmosChainId.OSMOSIS]: 'https://rpc.osmosis.zone',
    [CosmosChainId.JUNO]: 'https://rpc.juno.strange.love',
    [CosmosChainId.STARGAZE]: 'https://rpc.stargaze-apis.com',
    [CosmosChainId.AKASH]: 'https://rpc.akash.forbole.com',
    [CosmosChainId.COSMOSHUB_TESTNET]: 'https://rpc.sentry-01.theta-testnet.polypore.xyz',
    [CosmosChainId.OSMOSIS_TESTNET]: 'https://rpc.testnet.osmosis.zone',
  }

  return endpoints[chainId] ?? 'https://rpc.cosmos.network'
}

/**
 * Get default REST endpoint for Cosmos chains
 */
export function getDefaultRestEndpoint(chainId: string): string {
  const endpoints: Record<string, string> = {
    [CosmosChainId.COSMOSHUB]: 'https://api.cosmos.network',
    [CosmosChainId.OSMOSIS]: 'https://lcd.osmosis.zone',
    [CosmosChainId.JUNO]: 'https://api.juno.strange.love',
    [CosmosChainId.STARGAZE]: 'https://rest.stargaze-apis.com',
    [CosmosChainId.AKASH]: 'https://api.akash.forbole.com',
    [CosmosChainId.COSMOSHUB_TESTNET]: 'https://rest.sentry-01.theta-testnet.polypore.xyz',
    [CosmosChainId.OSMOSIS_TESTNET]: 'https://lcd.testnet.osmosis.zone',
  }

  return endpoints[chainId] ?? 'https://api.cosmos.network'
}
