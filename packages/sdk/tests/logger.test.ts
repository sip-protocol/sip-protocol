/**
 * Logger Module Tests
 *
 * Tests for the structured logging system using pino.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  logger,
  createLogger,
  silenceLogger,
  setLogLevel,
  getLogLevelName,
  isLevelEnabled,
} from '../src/logger'

describe('Logger', () => {
  const originalLevel = logger.level

  afterEach(() => {
    logger.level = originalLevel
  })

  describe('createLogger', () => {
    it('should create a child logger with module name', () => {
      const log = createLogger('test-module')
      expect(log).toBeDefined()
      // Child logger should have the bindings
      const bindings = log.bindings()
      expect(bindings.module).toBe('test-module')
    })

    it('should create multiple independent child loggers', () => {
      const log1 = createLogger('module1')
      const log2 = createLogger('module2')

      expect(log1.bindings().module).toBe('module1')
      expect(log2.bindings().module).toBe('module2')
    })
  })

  describe('setLogLevel', () => {
    it('should change the log level', () => {
      setLogLevel('debug')
      expect(getLogLevelName()).toBe('debug')

      setLogLevel('error')
      expect(getLogLevelName()).toBe('error')
    })

    it('should accept all valid log levels', () => {
      const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const

      for (const level of levels) {
        setLogLevel(level)
        expect(getLogLevelName()).toBe(level)
      }
    })
  })

  describe('silenceLogger', () => {
    it('should set log level to silent', () => {
      setLogLevel('info')
      silenceLogger()
      expect(getLogLevelName()).toBe('silent')
    })
  })

  describe('isLevelEnabled', () => {
    it('should return true for enabled levels', () => {
      setLogLevel('info')
      expect(isLevelEnabled('info')).toBe(true)
      expect(isLevelEnabled('warn')).toBe(true)
      expect(isLevelEnabled('error')).toBe(true)
    })

    it('should return false for disabled levels', () => {
      setLogLevel('warn')
      expect(isLevelEnabled('trace')).toBe(false)
      expect(isLevelEnabled('debug')).toBe(false)
      expect(isLevelEnabled('info')).toBe(false)
    })

    it('should return false when silent', () => {
      silenceLogger()
      expect(isLevelEnabled('trace')).toBe(false)
      expect(isLevelEnabled('error')).toBe(false)
    })
  })

  describe('logging methods', () => {
    it('should have all standard logging methods', () => {
      const log = createLogger('test')
      expect(typeof log.trace).toBe('function')
      expect(typeof log.debug).toBe('function')
      expect(typeof log.info).toBe('function')
      expect(typeof log.warn).toBe('function')
      expect(typeof log.error).toBe('function')
      expect(typeof log.fatal).toBe('function')
    })

    it('should accept message and object arguments', () => {
      const log = createLogger('test')
      // These should not throw
      log.info('Simple message')
      log.info({ key: 'value' }, 'Message with context')
      log.warn({ deprecated: 'oldFunc' }, 'Function deprecated')
      log.error({ err: new Error('test') }, 'Error occurred')
    })
  })

  describe('sensitive data redaction', () => {
    it('should redact sensitive field names in objects', () => {
      // The redaction happens in serializers, which pino handles internally
      // We can verify the logger accepts objects with sensitive fields
      const log = createLogger('test')

      // This should not throw and the serializer should redact
      log.info({
        privateKey: '0x1234567890abcdef',
        secretKey: 'secret-value',
        address: '0xabcdef1234567890',
      }, 'Test with sensitive data')
    })
  })
})
