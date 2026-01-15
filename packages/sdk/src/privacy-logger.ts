/**
 * Privacy-Aware Logger
 *
 * Provides logging utilities that automatically redact sensitive information
 * like wallet addresses and transaction amounts to prevent privacy leaks
 * through log aggregators or error reporting tools.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

export interface PrivacyLoggerConfig {
  prefix?: string
  level?: LogLevel
  productionMode?: boolean
  output?: (level: LogLevel, message: string) => void
  silent?: boolean
}

export interface SensitiveData {
  address?: string
  from?: string
  to?: string
  owner?: string
  amount?: bigint | number | string
  signature?: string
  txHash?: string
  [key: string]: unknown
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

const ADDRESS_FIELDS = new Set([
  'address', 'from', 'to', 'owner', 'sender', 'recipient', 'wallet', 'publicKey', 'pubkey',
])

const TX_FIELDS = new Set([
  'signature', 'txHash', 'txSignature', 'transactionHash', 'computationId',
])

export function redactAddress(address: string, chars: number = 4): string {
  if (!address || typeof address !== 'string') return '[invalid]'
  if (address.length <= chars * 2 + 3) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export function redactSignature(signature: string, chars: number = 6): string {
  if (!signature || typeof signature !== 'string') return '[invalid]'
  if (signature.length <= chars * 2 + 3) return signature
  return `${signature.slice(0, chars)}...${signature.slice(-chars)}`
}

export function maskAmount(
  amount: bigint | number | string,
  decimals: number = 9,
  symbol: string = ''
): string {
  let value: number
  if (typeof amount === 'bigint') {
    value = Number(amount) / 10 ** decimals
  } else if (typeof amount === 'string') {
    value = parseFloat(amount)
    if (isNaN(value)) return '[hidden]'
  } else {
    value = amount / 10 ** decimals
  }

  let range: string
  if (value <= 0) range = '0'
  else if (value < 0.01) range = '<0.01'
  else if (value < 0.1) range = '0.01-0.1'
  else if (value < 1) range = '0.1-1'
  else if (value < 10) range = '1-10'
  else if (value < 100) range = '10-100'
  else if (value < 1000) range = '100-1K'
  else if (value < 10000) range = '1K-10K'
  else if (value < 100000) range = '10K-100K'
  else range = '>100K'

  return symbol ? `${range} ${symbol}` : range
}

export function redactSensitiveData(
  data: SensitiveData,
  productionMode: boolean = false
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      result[key] = undefined
      continue
    }
    if (ADDRESS_FIELDS.has(key) && typeof value === 'string') {
      result[key] = redactAddress(value)
      continue
    }
    if (TX_FIELDS.has(key) && typeof value === 'string') {
      result[key] = redactSignature(value)
      continue
    }
    if (key === 'amount' || key.toLowerCase().includes('amount')) {
      if (typeof value === 'bigint' || typeof value === 'number' || typeof value === 'string') {
        result[key] = productionMode ? '[hidden]' : maskAmount(value)
      }
      continue
    }
    if (typeof value === 'string') result[key] = value
    else if (typeof value === 'number' || typeof value === 'bigint') result[key] = value.toString()
    else if (typeof value === 'boolean') result[key] = value.toString()
    else result[key] = '[object]'
  }
  return result
}

export class PrivacyLogger {
  private config: Required<PrivacyLoggerConfig>

  constructor(config: PrivacyLoggerConfig = {}) {
    this.config = {
      prefix: config.prefix ?? '',
      level: config.level ?? 'info',
      productionMode: config.productionMode ?? false,
      silent: config.silent ?? false,
      output: config.output ?? this.defaultOutput.bind(this),
    }
  }

  private defaultOutput(level: LogLevel, message: string): void {
    switch (level) {
      case 'debug': console.debug(message); break
      case 'info': console.info(message); break
      case 'warn': console.warn(message); break
      case 'error': console.error(message); break
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.config.silent) return false
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level]
  }

  private formatMessage(message: string, data?: SensitiveData): string {
    const prefix = this.config.prefix ? `${this.config.prefix} ` : ''
    if (!data || Object.keys(data).length === 0) return `${prefix}${message}`
    const redacted = redactSensitiveData(data, this.config.productionMode)
    const dataStr = Object.entries(redacted)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')
    return `${prefix}${message} ${dataStr}`
  }

  debug(message: string, data?: SensitiveData): void {
    if (this.shouldLog('debug')) this.config.output('debug', this.formatMessage(message, data))
  }

  info(message: string, data?: SensitiveData): void {
    if (this.shouldLog('info')) this.config.output('info', this.formatMessage(message, data))
  }

  warn(message: string, data?: SensitiveData): void {
    if (this.shouldLog('warn')) this.config.output('warn', this.formatMessage(message, data))
  }

  error(message: string, data?: SensitiveData): void {
    if (this.shouldLog('error')) this.config.output('error', this.formatMessage(message, data))
  }

  configure(config: Partial<PrivacyLoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  child(prefix: string): PrivacyLogger {
    const childPrefix = this.config.prefix ? `${this.config.prefix}${prefix}` : prefix
    return new PrivacyLogger({ ...this.config, prefix: childPrefix })
  }
}

export const privacyLogger = new PrivacyLogger({ prefix: '[SIP]', level: 'warn' })

export function createPrivacyLogger(
  moduleName: string,
  config: Partial<PrivacyLoggerConfig> = {}
): PrivacyLogger {
  return new PrivacyLogger({ prefix: `[${moduleName}]`, level: 'warn', ...config })
}
