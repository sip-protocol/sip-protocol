import { describe, it, expect } from 'vitest'
import { SIPStealthRecordV1, parseRecord } from '../src/schema'

const validHex = 'a'.repeat(64)

describe('SIPStealthRecordV1', () => {
  it('accepts a valid v1 record', () => {
    const result = SIPStealthRecordV1.safeParse({
      v: 1,
      spending: validHex,
      viewing: validHex,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing v', () => {
    const result = SIPStealthRecordV1.safeParse({
      spending: validHex,
      viewing: validHex,
    })
    expect(result.success).toBe(false)
  })

  it('rejects v=2 (forward-incompatible)', () => {
    const result = SIPStealthRecordV1.safeParse({
      v: 2,
      spending: validHex,
      viewing: validHex,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-hex spending key', () => {
    const result = SIPStealthRecordV1.safeParse({
      v: 1,
      spending: 'g'.repeat(64),
      viewing: validHex,
    })
    expect(result.success).toBe(false)
  })

  it('rejects wrong-length viewing key', () => {
    const result = SIPStealthRecordV1.safeParse({
      v: 1,
      spending: validHex,
      viewing: 'a'.repeat(63),
    })
    expect(result.success).toBe(false)
  })

  it('rejects uppercase hex (must be lowercase)', () => {
    const result = SIPStealthRecordV1.safeParse({
      v: 1,
      spending: 'A'.repeat(64),
      viewing: validHex,
    })
    expect(result.success).toBe(false)
  })
})

describe('parseRecord', () => {
  it('parses a valid JSON record', () => {
    const json = JSON.stringify({ v: 1, spending: validHex, viewing: validHex })
    const result = parseRecord(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.v).toBe(1)
    }
  })

  it('returns json-parse error for malformed JSON', () => {
    const result = parseRecord('{not json}')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('json-parse')
  })

  it('returns schema error for invalid record', () => {
    const json = JSON.stringify({ v: 1, spending: 'bad' })
    const result = parseRecord(json)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('schema')
  })
})
