import { Command } from 'commander'
import {
  PrivacyBackendRegistry,
  SIPNativeBackend,
  type PrivacyBackendType,
} from '@sip-protocol/sdk'
import { success, info, warning, heading, table, json as jsonOutput } from '../utils/output'
import chalk from 'chalk'

/**
 * Backend information for display
 */
interface BackendInfo {
  name: string
  type: PrivacyBackendType
  chains: string[]
  healthy: boolean
  failures: number
  enabled: boolean
  compliance: boolean
}

/**
 * Create a registry with available privacy backends
 *
 * Note: Currently only SIPNativeBackend is exported from the main SDK.
 * Other backends (PrivacyCash, Arcium, Inco, etc.) can be registered
 * when they are added to the main SDK exports.
 */
function createDefaultRegistry(): PrivacyBackendRegistry {
  const registry = new PrivacyBackendRegistry({ enableHealthTracking: true })

  // Register SIP Native backend (stealth addresses + Pedersen commitments)
  registry.register(new SIPNativeBackend())

  return registry
}

/**
 * Collect backend information from registry
 */
function collectBackendInfo(registry: PrivacyBackendRegistry): BackendInfo[] {
  const entries = registry.getAllEntries()
  const healthTracker = registry.getHealthTracker()
  const results: BackendInfo[] = []

  for (const entry of entries) {
    const backend = entry.backend
    const caps = backend.getCapabilities()

    // Get health state if available
    let healthy = true
    let failures = 0
    if (healthTracker) {
      const health = healthTracker.getHealth(backend.name)
      if (health) {
        healthy = health.isHealthy
        failures = health.consecutiveFailures
      }
    }

    results.push({
      name: backend.name,
      type: backend.type,
      chains: [...backend.chains],
      healthy,
      failures,
      enabled: entry.enabled,
      compliance: caps.complianceSupport,
    })
  }

  return results
}

export function createBackendsCommand(): Command {
  const cmd = new Command('backends')
    .description('Manage and list privacy backends')

  // List subcommand
  cmd.command('list')
    .description('List all registered privacy backends')
    .option('--health', 'Show health status')
    .option('--metrics', 'Show detailed metrics')
    .option('--json', 'Output as JSON')
    .option('--type <type>', 'Filter by type (transaction, compute, both)')
    .option('--chain <chain>', 'Filter by chain support')
    .action(async (options) => {
      try {
        const registry = createDefaultRegistry()
        let backends = collectBackendInfo(registry)

        // Apply filters
        if (options.type) {
          backends = backends.filter(b => b.type === options.type || b.type === 'both')
        }
        if (options.chain) {
          backends = backends.filter(b => b.chains.includes(options.chain))
        }

        // JSON output
        if (options.json) {
          jsonOutput({
            backends: backends.map(b => ({
              ...b,
              chains: b.chains,
            })),
            total: backends.length,
            healthy: backends.filter(b => b.healthy).length,
          })
          return
        }

        // Table output
        heading('Privacy Backends')

        if (backends.length === 0) {
          warning('No backends match the specified filters')
          return
        }

        // Build table
        const headers = ['NAME', 'TYPE', 'CHAINS', 'COMPLIANCE']
        if (options.health || options.metrics) {
          headers.push('HEALTHY', 'FAILURES')
        }

        const rows = backends.map(b => {
          const row: (string | number)[] = [
            b.enabled ? b.name : chalk.gray(b.name + ' (disabled)'),
            b.type,
            b.chains.join(', '),
            b.compliance ? chalk.green('✓') : chalk.gray('✗'),
          ]

          if (options.health || options.metrics) {
            row.push(
              b.healthy ? chalk.green('✓') : chalk.red('✗'),
              b.failures
            )
          }

          return row
        })

        table(headers, rows)

        // Summary
        console.log()
        const healthyCount = backends.filter(b => b.healthy).length
        const complianceCount = backends.filter(b => b.compliance).length

        success(`${backends.length} backend(s) registered`)

        if (options.health || options.metrics) {
          if (healthyCount === backends.length) {
            info(`All backends healthy`)
          } else {
            warning(`${healthyCount}/${backends.length} backends healthy`)
          }
        }

        info(`${complianceCount} backend(s) support compliance (viewing keys)`)

      } catch (err) {
        console.error('Failed to list backends:', err)
        process.exit(1)
      }
    })

  // Info subcommand for detailed backend information
  cmd.command('info <name>')
    .description('Show detailed information about a specific backend')
    .option('--json', 'Output as JSON')
    .action(async (name, options) => {
      try {
        const registry = createDefaultRegistry()
        const backend = registry.get(name)

        if (!backend) {
          console.error(`Backend '${name}' not found`)
          console.error('Available backends:', registry.getNames().join(', '))
          process.exit(1)
        }

        const caps = backend.getCapabilities()
        const healthTracker = registry.getHealthTracker()
        const health = healthTracker?.getHealth(name)
        const metrics = healthTracker?.getMetrics(name)

        const backendInfo = {
          name: backend.name,
          type: backend.type,
          chains: [...backend.chains],
          capabilities: {
            complianceSupport: caps.complianceSupport,
            anonymitySet: caps.anonymitySet,
            latency: caps.latencyEstimate,
            setupRequired: caps.setupRequired,
          },
          health: health ? {
            state: health.circuitState,
            isHealthy: health.isHealthy,
            consecutiveFailures: health.consecutiveFailures,
            consecutiveSuccesses: health.consecutiveSuccesses,
            lastFailureTime: health.lastFailureTime ? new Date(health.lastFailureTime).toISOString() : null,
            lastFailureReason: health.lastFailureReason ?? null,
          } : null,
          metrics: metrics ? {
            totalRequests: metrics.totalRequests,
            successfulRequests: metrics.successfulRequests,
            failedRequests: metrics.failedRequests,
            averageLatencyMs: Math.round(metrics.averageLatencyMs),
            successRate: metrics.totalRequests > 0
              ? Math.round((metrics.successfulRequests / metrics.totalRequests) * 100)
              : 0,
          } : null,
        }

        if (options.json) {
          jsonOutput(backendInfo)
          return
        }

        heading(`Backend: ${backend.name}`)

        console.log(chalk.bold('General'))
        console.log(`  Type:     ${backend.type}`)
        console.log(`  Chains:   ${backend.chains.join(', ')}`)
        console.log()

        console.log(chalk.bold('Capabilities'))
        console.log(`  Compliance:     ${caps.complianceSupport ? chalk.green('Yes') : chalk.gray('No')}`)
        console.log(`  Anonymity Set:  ${caps.anonymitySet ?? 'N/A'}`)
        console.log(`  Est. Latency:   ${caps.latencyEstimate}`)
        console.log(`  Setup Required: ${caps.setupRequired ? 'Yes' : 'No'}`)

        if (health) {
          console.log()
          console.log(chalk.bold('Health'))
          console.log(`  State:      ${health.circuitState === 'closed' ? chalk.green('Healthy') : chalk.red(health.circuitState)}`)
          console.log(`  Healthy:    ${health.isHealthy ? chalk.green('Yes') : chalk.red('No')}`)
          console.log(`  Failures:   ${health.consecutiveFailures}`)
          console.log(`  Successes:  ${health.consecutiveSuccesses}`)
          if (health.lastFailureReason) {
            console.log(`  Last Error: ${health.lastFailureReason}`)
          }
        }

        if (metrics) {
          console.log()
          console.log(chalk.bold('Metrics'))
          console.log(`  Total Requests: ${metrics.totalRequests}`)
          console.log(`  Success Rate:   ${backendInfo.metrics?.successRate}%`)
          console.log(`  Avg Latency:    ${backendInfo.metrics?.averageLatencyMs}ms`)
        }

      } catch (err) {
        console.error('Failed to get backend info:', err)
        process.exit(1)
      }
    })

  return cmd
}
