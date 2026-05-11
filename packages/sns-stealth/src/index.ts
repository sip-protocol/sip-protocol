// Core resolution + publish API
export { resolveSIPStealth, invalidateCache, MetaAddress } from './resolve'
export type { ResolveResult } from './resolve'

export { buildPublishTx } from './publish'
export type { PublishKeys } from './publish'

export { deriveStealthKeys, normalizeDomain, deriveSeed } from './derive'
export type { Signer, DerivedStealthKeys } from './derive'

// Record schema
export { SIPStealthRecordV1, parseRecord, encodeRecord } from './schema'
export type { SIPStealthRecord, ParseResult } from './schema'

// Typed errors
export {
  NotFound,
  Malformed,
  NetworkError,
  UserRejected,
  OnChainError,
} from './errors'
export type { NotFoundSubject, MalformedReason } from './errors'
