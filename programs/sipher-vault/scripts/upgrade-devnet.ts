// programs/sipher-vault/scripts/upgrade-devnet.ts
//
// Build the program and deploy the resulting binary to devnet under the
// existing program ID. Idempotent — running again redeploys (Solana's
// program upgrade pattern).
//
// Usage: pnpm exec tsx scripts/upgrade-devnet.ts
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'

const PROGRAM_ID = 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB'
const PROGRAM_KEYPAIR = `${homedir()}/Documents/secret/sipher-vault-program-id.json`
const AUTHORITY_KEYPAIR = `${homedir()}/Documents/secret/solana-devnet.json`
const SO_FILE = 'target/deploy/sipher_vault.so'
const RPC = 'https://api.devnet.solana.com'

function run(cmd: string): string {
  console.log('$', cmd)
  const out = execSync(cmd, { stdio: ['inherit', 'pipe', 'inherit'] }).toString()
  console.log(out)
  return out
}

async function main() {
  if (!existsSync(PROGRAM_KEYPAIR)) {
    throw new Error(`Program keypair not found: ${PROGRAM_KEYPAIR}`)
  }
  if (!existsSync(AUTHORITY_KEYPAIR)) {
    throw new Error(`Authority keypair not found: ${AUTHORITY_KEYPAIR}`)
  }

  // 1. Sanity: program ID matches the keypair
  const idFromKey = run(`solana address -k ${PROGRAM_KEYPAIR}`).trim()
  if (idFromKey !== PROGRAM_ID) {
    throw new Error(`Program keypair ID ${idFromKey} != expected ${PROGRAM_ID}`)
  }

  // 2. Clean + build
  // Note: `--no-idl` is required because anchor 0.30.1's IDL generator
  // depends on `proc_macro2::Span::source_file()`, a nightly-only proc-macro
  // API that has been removed from current host rustc (1.94+). The on-chain
  // SBF binary builds correctly via Solana's pinned platform-tools toolchain;
  // only the host-side IDL generation is affected. The IDL artifact already
  // exists at target/idl/sipher_vault.json and is regenerated whenever a
  // compatible host toolchain is available.
  run('anchor clean')
  run('anchor build --no-idl')

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
