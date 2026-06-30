// programs/sipher-vault/scripts/upgrade-devnet.ts
//
// Build the program and deploy the resulting binary to devnet under the
// existing program ID. Idempotent — running again redeploys (Solana's
// program upgrade pattern).
//
// Usage: cd programs/sipher-vault && pnpm exec tsx scripts/upgrade-devnet.ts
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'

const PROGRAM_ID = 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB'
const PROGRAM_KEYPAIR = `${homedir()}/Documents/secret/sipher-vault-program-id.json`
const AUTHORITY_KEYPAIR = process.env.ANCHOR_WALLET ?? `${homedir()}/Documents/secret/solana-devnet.json`
const SO_FILE = 'target/deploy/sipher_vault.so'
const RPC = process.env.ANCHOR_PROVIDER_URL ?? 'https://api.devnet.solana.com'

// Run a command with live stdout/stderr streamed to the terminal. No return value.
// Use this for build, deploy, and post-deploy show — where the operator needs to
// see progress in real time. `anchor build` (10-30s) and `solana program deploy`
// (30s-5min) would otherwise leave the terminal frozen until completion.
function run(cmd: string): void {
  console.log('$', cmd)
  execSync(cmd, { stdio: 'inherit' })
}

// Run a command and capture stdout as a trimmed string. Stderr still inherits.
// Use this when the script needs to parse the command's output.
function capture(cmd: string): string {
  console.log('$', cmd)
  return execSync(cmd, { stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf-8' }).trim()
}

async function main() {
  if (!existsSync(PROGRAM_KEYPAIR)) {
    throw new Error(`Program keypair not found: ${PROGRAM_KEYPAIR}`)
  }
  if (!existsSync(AUTHORITY_KEYPAIR)) {
    throw new Error(`Authority keypair not found: ${AUTHORITY_KEYPAIR}`)
  }

  // 1. Sanity: program ID matches the keypair
  const idFromKey = capture(`solana address -k ${PROGRAM_KEYPAIR}`)
  if (idFromKey !== PROGRAM_ID) {
    throw new Error(`Program keypair ID ${idFromKey} != expected ${PROGRAM_ID}`)
  }

  // 2. Build
  // `--no-idl`: skip IDL regeneration during deploy so the committed
  // `target/idl/sipher_vault.json` (downstream consumers — the agent SDK, UI —
  // depend on it) stays stable; regenerate it intentionally via `anchor build` /
  // `anchor test` when the interface changes, not as a side effect of deploying.
  // `--ignore-keys`: skip Anchor's declare_id-vs-`target/deploy/<name>-keypair.json`
  // check. On a fresh checkout or a git worktree that keypair is auto-generated and
  // won't match `declare_id!`, aborting the build; the deploy pins the program ID via
  // `--program-id` below, so the source `declare_id!` is the authoritative ID.
  run('anchor build --no-idl --ignore-keys')

  if (!existsSync(SO_FILE)) {
    throw new Error(`Build artifact missing: ${SO_FILE}`)
  }

  // 3. Deploy
  run(
    `solana program deploy ${SO_FILE} ` +
      `--program-id ${PROGRAM_KEYPAIR} ` +
      `--keypair ${AUTHORITY_KEYPAIR} ` +
      `--url ${RPC} ` +
      `--with-compute-unit-price 10000`
  )

  // 4. Verify deployed slot
  run(`solana program show ${PROGRAM_ID} --url ${RPC}`)

  console.log('Devnet upgrade complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
