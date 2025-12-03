#!/usr/bin/env node

/**
 * Benchmark Runner Script
 *
 * Runs proof generation benchmarks and saves results to JSON.
 * Used for tracking performance over time and CI integration.
 *
 * Usage:
 *   node scripts/run-benchmarks.js [--noir] [--output results.json]
 *
 * Options:
 *   --noir     Enable Noir/WASM benchmarks (slower, requires WASM)
 *   --output   Output file for results (default: benchmarks/results.json)
 *   --compare  Compare with previous results and report regressions
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/141
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

// Parse arguments
const args = process.argv.slice(2)
const enableNoir = args.includes('--noir')
const compareMode = args.includes('--compare')
const outputIndex = args.indexOf('--output')
const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : 'packages/sdk/benchmarks/results.json'

// Colors
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

/**
 * Run vitest benchmarks and capture output
 */
async function runBenchmarks() {
  log('\n========================================', colors.cyan)
  log('  SIP Protocol Benchmark Suite', colors.cyan)
  log('========================================\n', colors.cyan)

  log(`Noir/WASM benchmarks: ${enableNoir ? 'ENABLED' : 'disabled'}`)
  log(`Output file: ${outputFile}`)
  log('')

  const env = { ...process.env }
  if (enableNoir) {
    env.BENCH_NOIR = '1'
  }

  return new Promise((resolve, reject) => {
    const benchProcess = spawn('npx', [
      'vitest',
      'bench',
      'tests/benchmarks/proof-generation.bench.ts',
      '--run',
      '--reporter=json',
    ], {
      cwd: path.join(__dirname, '..', 'packages', 'sdk'),
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    benchProcess.stdout.on('data', (data) => {
      stdout += data.toString()
      process.stdout.write(data)
    })

    benchProcess.stderr.on('data', (data) => {
      stderr += data.toString()
      process.stderr.write(data)
    })

    benchProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        // Benchmarks may exit with non-zero even on success
        resolve({ stdout, stderr })
      }
    })

    benchProcess.on('error', reject)
  })
}

/**
 * Parse benchmark results from vitest output
 */
function parseResults(output) {
  const results = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    noirEnabled: enableNoir,
    benchmarks: [],
  }

  // Try to extract timing from output
  const lines = output.split('\n')
  for (const line of lines) {
    // Look for benchmark result lines like: "✓ name ... 123.45 ms"
    const match = line.match(/[✓✔]\s+(.+?)\s+[\d.]+\s*(?:ops\/sec|ms)/i)
    if (match) {
      const name = match[1].trim()
      const timeMatch = line.match(/([\d.]+)\s*ms/)
      const opsMatch = line.match(/([\d.]+)\s*ops\/sec/)

      results.benchmarks.push({
        name,
        timeMs: timeMatch ? parseFloat(timeMatch[1]) : null,
        opsPerSec: opsMatch ? parseFloat(opsMatch[1]) : null,
      })
    }
  }

  return results
}

/**
 * Save results to JSON file
 */
function saveResults(results) {
  const outputPath = path.resolve(__dirname, '..', outputFile)
  const outputDir = path.dirname(outputPath)

  // Create directory if needed
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Load existing results if any
  let allResults = []
  if (fs.existsSync(outputPath)) {
    try {
      allResults = JSON.parse(fs.readFileSync(outputPath, 'utf-8'))
      if (!Array.isArray(allResults)) {
        allResults = [allResults]
      }
    } catch {
      allResults = []
    }
  }

  // Keep last 100 results
  allResults.push(results)
  if (allResults.length > 100) {
    allResults = allResults.slice(-100)
  }

  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2))
  log(`\nResults saved to: ${outputPath}`, colors.green)
}

/**
 * Compare with previous results and detect regressions
 */
function compareResults(results, outputPath) {
  const fullPath = path.resolve(__dirname, '..', outputPath)

  if (!fs.existsSync(fullPath)) {
    log('\nNo previous results to compare', colors.yellow)
    return { hasRegression: false }
  }

  let allResults
  try {
    allResults = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
    if (!Array.isArray(allResults) || allResults.length < 2) {
      log('\nNot enough previous results to compare', colors.yellow)
      return { hasRegression: false }
    }
  } catch {
    return { hasRegression: false }
  }

  const previous = allResults[allResults.length - 2]
  const current = results

  log('\n========================================', colors.cyan)
  log('  Performance Comparison', colors.cyan)
  log('========================================\n', colors.cyan)

  let hasRegression = false
  const REGRESSION_THRESHOLD = 0.20 // 20% slower = regression

  for (const currentBench of current.benchmarks) {
    const prevBench = previous.benchmarks?.find(b => b.name === currentBench.name)
    if (!prevBench || !prevBench.timeMs || !currentBench.timeMs) continue

    const diff = (currentBench.timeMs - prevBench.timeMs) / prevBench.timeMs
    const diffPercent = (diff * 100).toFixed(1)
    const arrow = diff > 0 ? '↑' : '↓'

    if (diff > REGRESSION_THRESHOLD) {
      log(`  ${currentBench.name}: ${prevBench.timeMs.toFixed(2)}ms → ${currentBench.timeMs.toFixed(2)}ms (${arrow}${diffPercent}%) ⚠️ REGRESSION`, colors.red)
      hasRegression = true
    } else if (diff < -0.10) {
      log(`  ${currentBench.name}: ${prevBench.timeMs.toFixed(2)}ms → ${currentBench.timeMs.toFixed(2)}ms (${arrow}${diffPercent}%) ✓ IMPROVED`, colors.green)
    } else {
      log(`  ${currentBench.name}: ${prevBench.timeMs.toFixed(2)}ms → ${currentBench.timeMs.toFixed(2)}ms (${arrow}${diffPercent}%)`, colors.dim)
    }
  }

  return { hasRegression }
}

/**
 * Main
 */
async function main() {
  try {
    const { stdout } = await runBenchmarks()
    const results = parseResults(stdout)

    log('\n========================================', colors.cyan)
    log('  Summary', colors.cyan)
    log('========================================\n', colors.cyan)

    log(`Benchmarks run: ${results.benchmarks.length}`)
    log(`Node.js: ${results.nodeVersion}`)
    log(`Platform: ${results.platform} ${results.arch}`)

    saveResults(results)

    if (compareMode) {
      const { hasRegression } = compareResults(results, outputFile)
      if (hasRegression) {
        log('\n⚠️  Performance regression detected!', colors.red)
        process.exit(1)
      }
    }

    log('\n✅ Benchmarks completed successfully', colors.green)
  } catch (error) {
    log(`\n❌ Benchmark failed: ${error.message}`, colors.red)
    process.exit(1)
  }
}

main()
