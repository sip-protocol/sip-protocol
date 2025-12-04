/**
 * CLI Commands Tests
 *
 * Tests for CLI command creation and structure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'
import {
  createInitCommand,
  createKeygenCommand,
  createCommitCommand,
  createProveCommand,
  createVerifyCommand,
  createQuoteCommand,
  createSwapCommand,
  createScanCommand,
} from '../src/commands'

// Suppress console output during tests
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CLI Commands', () => {
  describe('Command Creation', () => {
    it('should create init command', () => {
      const cmd = createInitCommand()
      expect(cmd).toBeInstanceOf(Command)
      expect(cmd.name()).toBe('init')
    })

    it('should create keygen command', () => {
      const cmd = createKeygenCommand()
      expect(cmd).toBeInstanceOf(Command)
      expect(cmd.name()).toBe('keygen')
    })

    it('should create commit command', () => {
      const cmd = createCommitCommand()
      expect(cmd).toBeInstanceOf(Command)
      expect(cmd.name()).toBe('commit')
    })

    it('should create prove command', () => {
      const cmd = createProveCommand()
      expect(cmd).toBeInstanceOf(Command)
      expect(cmd.name()).toBe('prove')
    })

    it('should create verify command', () => {
      const cmd = createVerifyCommand()
      expect(cmd).toBeInstanceOf(Command)
      expect(cmd.name()).toBe('verify')
    })

    it('should create quote command', () => {
      const cmd = createQuoteCommand()
      expect(cmd).toBeInstanceOf(Command)
      expect(cmd.name()).toBe('quote')
    })

    it('should create swap command', () => {
      const cmd = createSwapCommand()
      expect(cmd).toBeInstanceOf(Command)
      expect(cmd.name()).toBe('swap')
    })

    it('should create scan command', () => {
      const cmd = createScanCommand()
      expect(cmd).toBeInstanceOf(Command)
      expect(cmd.name()).toBe('scan')
    })
  })

  describe('Command Options', () => {
    it('keygen should have chain option', () => {
      const cmd = createKeygenCommand()
      const options = cmd.options.map(o => o.long || o.short)
      expect(options).toContain('--chain')
    })

    it('commit should accept amount argument', () => {
      const cmd = createCommitCommand()
      const args = cmd.registeredArguments || []
      expect(args.length).toBeGreaterThan(0)
      expect(args[0].name()).toBe('amount')
    })

    it('quote should have chain arguments and token option', () => {
      const cmd = createQuoteCommand()
      const args = cmd.registeredArguments || []
      const options = cmd.options.map(o => o.long || o.short)

      // Check arguments
      expect(args.length).toBe(3)
      expect(args[0].name()).toBe('from-chain')
      expect(args[1].name()).toBe('to-chain')
      expect(args[2].name()).toBe('amount')

      // Check options
      expect(options).toContain('--token')
      expect(options).toContain('--privacy')
    })
  })

  describe('Command Descriptions', () => {
    it('all commands should have descriptions', () => {
      const commands = [
        createInitCommand(),
        createKeygenCommand(),
        createCommitCommand(),
        createProveCommand(),
        createVerifyCommand(),
        createQuoteCommand(),
        createSwapCommand(),
        createScanCommand(),
      ]

      commands.forEach(cmd => {
        expect(cmd.description()).toBeTruthy()
        expect(cmd.description().length).toBeGreaterThan(0)
      })
    })
  })
})

describe('Main Program', () => {
  it('should create program with all commands', () => {
    const program = new Command()
    program.name('sip')
    program.version('0.1.0')

    program.addCommand(createInitCommand())
    program.addCommand(createKeygenCommand())
    program.addCommand(createCommitCommand())
    program.addCommand(createProveCommand())
    program.addCommand(createVerifyCommand())
    program.addCommand(createQuoteCommand())
    program.addCommand(createSwapCommand())
    program.addCommand(createScanCommand())

    const commandNames = program.commands.map(c => c.name())
    expect(commandNames).toContain('init')
    expect(commandNames).toContain('keygen')
    expect(commandNames).toContain('commit')
    expect(commandNames).toContain('prove')
    expect(commandNames).toContain('verify')
    expect(commandNames).toContain('quote')
    expect(commandNames).toContain('swap')
    expect(commandNames).toContain('scan')
  })
})
