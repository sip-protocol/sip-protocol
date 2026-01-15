import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PrivacyLogger,
  createPrivacyLogger,
  privacyLogger,
  redactAddress,
  redactSignature,
  maskAmount,
  redactSensitiveData,
} from '../src/privacy-logger'

describe('redactAddress', () => {
  it('should redact a standard Solana address', () => {
    expect(redactAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')).toBe('7xKX...gAsU')
  })
  it('should handle empty string', () => {
    expect(redactAddress('')).toBe('[invalid]')
  })
  it('should handle null', () => {
    expect(redactAddress(null as unknown as string)).toBe('[invalid]')
  })
})

describe('redactSignature', () => {
  it('should redact a transaction signature', () => {
    expect(redactSignature('5UHBqFQ6nFBfMqYD8T2N7YRB7gXqKcvZKTAGLvqCGxqB7QprZR8C3qYvzVNKxGRv8z')).toBe('5UHBqF...xGRv8z')
  })
  it('should handle empty', () => {
    expect(redactSignature('')).toBe('[invalid]')
  })
})

describe('maskAmount', () => {
  it('should mask SOL amount', () => {
    expect(maskAmount(1_500_000_000n, 9, 'SOL')).toBe('1-10 SOL')
  })
  it('should mask small amount', () => {
    expect(maskAmount(1_000_000n, 9, 'SOL')).toBe('<0.01 SOL')
  })
  it('should handle zero', () => {
    expect(maskAmount(0n, 9)).toBe('0')
  })
  it('should handle invalid string', () => {
    expect(maskAmount('invalid', 0)).toBe('[hidden]')
  })
})

describe('redactSensitiveData', () => {
  it('should redact address fields', () => {
    const result = redactSensitiveData({
      from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    })
    expect(result.from).toBe('7xKX...gAsU')
  })
  it('should hide amounts in production mode', () => {
    const result = redactSensitiveData({ amount: 1_500_000_000n }, true)
    expect(result.amount).toBe('[hidden]')
  })
})

describe('PrivacyLogger', () => {
  let outputMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    outputMock = vi.fn()
  })

  it('should create with default config', () => {
    const logger = new PrivacyLogger()
    expect(logger).toBeDefined()
  })

  it('should accept custom prefix', () => {
    const logger = new PrivacyLogger({ prefix: '[Test]', output: outputMock, level: 'debug' })
    logger.debug('test message')
    expect(outputMock).toHaveBeenCalledWith('debug', '[Test] test message')
  })

  it('should respect log levels', () => {
    const logger = new PrivacyLogger({ level: 'error', output: outputMock })
    logger.debug('test')
    logger.info('test')
    logger.warn('test')
    logger.error('should appear')
    expect(outputMock).toHaveBeenCalledTimes(1)
  })

  it('should redact addresses in log data', () => {
    const logger = new PrivacyLogger({ output: outputMock, level: 'debug' })
    logger.debug('Transfer', { from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' })
    expect(outputMock).toHaveBeenCalledWith('debug', 'Transfer from=7xKX...gAsU')
  })

  it('should support silent mode', () => {
    const logger = new PrivacyLogger({ silent: true, output: outputMock })
    logger.error('test')
    expect(outputMock).not.toHaveBeenCalled()
  })

  it('should create child logger', () => {
    const parent = new PrivacyLogger({ prefix: '[Parent]', output: outputMock, level: 'debug' })
    const child = parent.child('[Child]')
    child.debug('test')
    expect(outputMock).toHaveBeenCalledWith('debug', '[Parent][Child] test')
  })
})

describe('createPrivacyLogger', () => {
  it('should create logger with module prefix', () => {
    const outputMock = vi.fn()
    const logger = createPrivacyLogger('MyModule', { output: outputMock, level: 'debug' })
    logger.debug('test')
    expect(outputMock).toHaveBeenCalledWith('debug', '[MyModule] test')
  })
})

describe('privacyLogger', () => {
  it('should be a PrivacyLogger instance', () => {
    expect(privacyLogger).toBeInstanceOf(PrivacyLogger)
  })
})
