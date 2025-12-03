#!/usr/bin/env node

/**
 * Circuit Validation Script
 *
 * Validates Noir circuit artifacts for SIP Protocol.
 * Ensures all circuit JSON files are valid and can be used for proof generation.
 *
 * Usage:
 *   node scripts/validate-circuits.js
 *
 * Exit codes:
 *   0 - All circuits valid
 *   1 - Validation failed
 */

const fs = require('fs')
const path = require('path')

// Circuit definitions
const CIRCUITS = [
  {
    name: 'funding_proof',
    path: 'packages/sdk/src/proofs/circuits/funding_proof.json',
    // Note: commitment_hash is now a return value, not an input parameter
    requiredParams: ['minimum_required', 'asset_id', 'balance', 'blinding'],
  },
  {
    name: 'validity_proof',
    path: 'packages/sdk/src/proofs/circuits/validity_proof.json',
    requiredParams: ['intent_hash', 'sender_commitment_x', 'sender_commitment_y', 'nullifier', 'timestamp', 'expiry'],
  },
  {
    name: 'fulfillment_proof',
    path: 'packages/sdk/src/proofs/circuits/fulfillment_proof.json',
    requiredParams: ['intent_hash', 'output_commitment_x', 'output_commitment_y', 'min_output_amount', 'solver_id'],
  },
]

// Required fields in circuit JSON
const REQUIRED_FIELDS = ['noir_version', 'hash', 'abi', 'bytecode']

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`  ✓ ${message}`, colors.green)
}

function logError(message) {
  log(`  ✗ ${message}`, colors.red)
}

function logWarning(message) {
  log(`  ⚠ ${message}`, colors.yellow)
}

function logInfo(message) {
  log(`  ℹ ${message}`, colors.dim)
}

/**
 * Validate a single circuit
 */
function validateCircuit(circuit, rootDir) {
  const errors = []
  const warnings = []
  const fullPath = path.join(rootDir, circuit.path)

  log(`\nValidating ${circuit.name}...`, colors.cyan)
  logInfo(`Path: ${circuit.path}`)

  // Check file exists
  if (!fs.existsSync(fullPath)) {
    errors.push(`Circuit file not found: ${circuit.path}`)
    logError(`File not found`)
    return { errors, warnings }
  }

  // Read and parse JSON
  let circuitData
  try {
    const content = fs.readFileSync(fullPath, 'utf-8')
    circuitData = JSON.parse(content)
    logSuccess(`Valid JSON`)
  } catch (e) {
    errors.push(`Invalid JSON in ${circuit.name}: ${e.message}`)
    logError(`Invalid JSON: ${e.message}`)
    return { errors, warnings }
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!circuitData[field]) {
      errors.push(`Missing required field '${field}' in ${circuit.name}`)
      logError(`Missing field: ${field}`)
    } else {
      logSuccess(`Has ${field}`)
    }
  }

  // Validate noir_version
  if (circuitData.noir_version) {
    const version = circuitData.noir_version.split('+')[0]
    logInfo(`Noir version: ${version}`)

    // Check for minimum version (1.0.0-beta.0 or higher)
    if (!version.startsWith('1.') && !version.startsWith('0.')) {
      warnings.push(`Unusual Noir version: ${version}`)
      logWarning(`Unusual version format`)
    }
  }

  // Validate bytecode
  if (circuitData.bytecode) {
    // Bytecode should be base64-encoded gzip
    const bytecodeLength = circuitData.bytecode.length
    if (bytecodeLength < 100) {
      warnings.push(`Suspiciously short bytecode in ${circuit.name}`)
      logWarning(`Short bytecode (${bytecodeLength} chars)`)
    } else {
      logSuccess(`Bytecode present (${bytecodeLength} chars)`)
    }
  }

  // Validate ABI
  if (circuitData.abi) {
    const params = circuitData.abi.parameters || []
    const paramNames = params.map((p) => p.name)

    logInfo(`Parameters: ${paramNames.join(', ')}`)

    // Check for expected parameters
    for (const expectedParam of circuit.requiredParams) {
      if (!paramNames.includes(expectedParam)) {
        errors.push(`Missing expected parameter '${expectedParam}' in ${circuit.name}`)
        logError(`Missing param: ${expectedParam}`)
      }
    }

    // Check parameter types
    for (const param of params) {
      if (!param.type || !param.type.kind) {
        warnings.push(`Parameter '${param.name}' has no type in ${circuit.name}`)
        logWarning(`No type for param: ${param.name}`)
      }
    }

    // Check for public/private visibility
    const publicParams = params.filter((p) => p.visibility === 'public')
    const privateParams = params.filter((p) => p.visibility === 'private')
    logInfo(`Public: ${publicParams.length}, Private: ${privateParams.length}`)
  }

  // Validate hash
  if (circuitData.hash) {
    logSuccess(`Circuit hash: ${circuitData.hash.substring(0, 16)}...`)
  }

  // Check for expression_width (constraint system)
  if (circuitData.expression_width) {
    const width = circuitData.expression_width
    if (width.Bounded) {
      logInfo(`Expression width: ${width.Bounded.width}`)
    }
  }

  return { errors, warnings }
}

/**
 * Main validation function
 */
function main() {
  log('\n========================================', colors.cyan)
  log('  SIP Protocol Circuit Validation', colors.cyan)
  log('========================================\n', colors.cyan)

  // Find project root (where package.json is)
  let rootDir = process.cwd()
  while (!fs.existsSync(path.join(rootDir, 'package.json'))) {
    const parent = path.dirname(rootDir)
    if (parent === rootDir) {
      log('Error: Could not find project root', colors.red)
      process.exit(1)
    }
    rootDir = parent
  }

  logInfo(`Project root: ${rootDir}`)

  let totalErrors = []
  let totalWarnings = []

  // Validate each circuit
  for (const circuit of CIRCUITS) {
    const { errors, warnings } = validateCircuit(circuit, rootDir)
    totalErrors = totalErrors.concat(errors)
    totalWarnings = totalWarnings.concat(warnings)
  }

  // Summary
  log('\n========================================', colors.cyan)
  log('  Summary', colors.cyan)
  log('========================================\n', colors.cyan)

  log(`Circuits validated: ${CIRCUITS.length}`)
  log(`Errors: ${totalErrors.length}`, totalErrors.length > 0 ? colors.red : colors.green)
  log(`Warnings: ${totalWarnings.length}`, totalWarnings.length > 0 ? colors.yellow : colors.green)

  if (totalErrors.length > 0) {
    log('\nErrors:', colors.red)
    for (const error of totalErrors) {
      log(`  - ${error}`, colors.red)
    }
  }

  if (totalWarnings.length > 0) {
    log('\nWarnings:', colors.yellow)
    for (const warning of totalWarnings) {
      log(`  - ${warning}`, colors.yellow)
    }
  }

  // Exit with appropriate code
  if (totalErrors.length > 0) {
    log('\n❌ Circuit validation failed!', colors.red)
    process.exit(1)
  } else {
    log('\n✅ All circuits valid!', colors.green)
    process.exit(0)
  }
}

main()
