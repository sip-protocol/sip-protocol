#!/usr/bin/env node

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
  createSetupCommand,
  createStealthCommand,
  createViewingKeyCommand,
  createBackendsCommand,
  createProofCommand,
} from './commands'

const program = new Command()

program
  .name('sip')
  .description('Shielded Intents Protocol (SIP) - Privacy layer for cross-chain transactions')
  .version('0.2.0')

// Register all commands
program.addCommand(createSetupCommand())      // Interactive setup wizard
program.addCommand(createInitCommand())
program.addCommand(createKeygenCommand())
program.addCommand(createStealthCommand())    // Stealth address operations
program.addCommand(createViewingKeyCommand()) // Viewing key management
program.addCommand(createCommitCommand())
program.addCommand(createProveCommand())
program.addCommand(createVerifyCommand())
program.addCommand(createQuoteCommand())
program.addCommand(createSwapCommand())
program.addCommand(createScanCommand())
program.addCommand(createBackendsCommand())  // Privacy backends management
program.addCommand(createProofCommand())    // Proof composition (M20)

// Parse arguments
program.parse()
