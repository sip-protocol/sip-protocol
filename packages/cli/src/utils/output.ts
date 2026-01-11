import chalk from 'chalk'
import ora, { Ora } from 'ora'

export function success(message: string): void {
  console.log(chalk.green('✓'), message)
}

export function error(message: string): void {
  console.error(chalk.red('✗'), message)
}

export function warning(message: string): void {
  console.warn(chalk.yellow('⚠'), message)
}

export function info(message: string): void {
  console.log(chalk.blue('ℹ'), message)
}

export function heading(message: string): void {
  console.log(chalk.bold.cyan(`\n${message}\n`))
}

export function keyValue(key: string, value: string | number | bigint): void {
  console.log(chalk.gray(`  ${key}:`), chalk.white(String(value)))
}

export function json(data: unknown): void {
  console.log(JSON.stringify(data, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 2))
}

export function spinner(text: string): Ora {
  return ora(text).start()
}

export function table(headers: string[], rows: (string | number)[][]): void {
  // Simple table output
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i] || '').length))
  )

  // Header
  console.log(
    headers.map((h, i) => chalk.bold(h.padEnd(colWidths[i]))).join('  ')
  )
  console.log(colWidths.map(w => '─'.repeat(w)).join('  '))

  // Rows
  rows.forEach(row => {
    console.log(
      row.map((cell, i) => String(cell).padEnd(colWidths[i])).join('  ')
    )
  })
}

export function formatAmount(amount: bigint, decimals = 18): string {
  const divisor = 10n ** BigInt(decimals)
  const integer = amount / divisor
  const fraction = amount % divisor
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 6)
  return `${integer}.${fractionStr}`
}

export function formatHash(hash: string, length = 8): string {
  if (hash.length <= length * 2) return hash
  return `${hash.slice(0, length)}...${hash.slice(-length)}`
}

export function divider(): void {
  console.log(chalk.gray('  ─────────────────────────────────────────────────'))
}
