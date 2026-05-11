import { describe, it, expect } from 'vitest'
import {
  NotFound,
  Malformed,
  NetworkError,
  UserRejected,
  OnChainError,
} from '../src/errors'

describe('NotFound', () => {
  it('discriminates on subject', () => {
    const e = new NotFound('domain')
    expect(e.subject).toBe('domain')
    expect(e).toBeInstanceOf(NotFound)
    expect(e.name).toBe('NotFound')
  })

  it('accepts record subject', () => {
    expect(new NotFound('record').subject).toBe('record')
  })
})

describe('Malformed', () => {
  it('captures reason and cause', () => {
    const cause = new Error('parse failure')
    const e = new Malformed('json-parse', cause)
    expect(e.reason).toBe('json-parse')
    expect(e.cause).toBe(cause)
  })

  it('supports schema reason', () => {
    const e = new Malformed('schema')
    expect(e.reason).toBe('schema')
  })
})

describe('NetworkError', () => {
  it('wraps underlying transport error', () => {
    const inner = new Error('connection refused')
    const e = new NetworkError('rpc unreachable', inner)
    expect(e.cause).toBe(inner)
    expect(e.message).toContain('rpc unreachable')
  })
})

describe('UserRejected and OnChainError', () => {
  it('are distinct constructors', () => {
    expect(new UserRejected()).toBeInstanceOf(UserRejected)
    expect(new OnChainError('signature', 'tx failed')).toBeInstanceOf(OnChainError)
    expect(new UserRejected()).not.toBeInstanceOf(OnChainError)
  })

  it('OnChainError exposes signature', () => {
    const e = new OnChainError('abc123', 'tx failed')
    expect(e.signature).toBe('abc123')
  })
})
