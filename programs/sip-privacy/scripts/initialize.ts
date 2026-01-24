import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js"
import { SipPrivacy } from "../target/types/sip_privacy"
import * as fs from "fs"

async function main() {
  // Connect to devnet
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed")

  // Load authority keypair
  const authorityPath = "/tmp/sip-authority.json"
  const authorityKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(authorityPath, "utf-8")))
  )

  const wallet = new anchor.Wallet(authorityKeypair)
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" })
  anchor.setProvider(provider)

  // Load program
  const programId = new PublicKey("S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at")
  const idl = JSON.parse(fs.readFileSync("./target/idl/sip_privacy.json", "utf-8"))
  const program = new Program(idl, provider) as Program<SipPrivacy>

  // Find config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  )

  console.log("Program ID:", programId.toString())
  console.log("Authority:", authorityKeypair.publicKey.toString())
  console.log("Config PDA:", configPda.toString())

  // Initialize with 0.5% fee (50 basis points)
  const feeBps = 50

  try {
    const tx = await program.methods
      .initialize(feeBps)
      .accounts({
        config: configPda,
        authority: authorityKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    console.log("✓ Initialized! Tx:", tx)

    // Fetch and display config
    const config = await program.account.config.fetch(configPda)
    console.log("Config:")
    console.log("  Authority:", config.authority.toString())
    console.log("  Fee BPS:", config.feeBps)
    console.log("  Paused:", config.paused)
    console.log("  Total Transfers:", config.totalTransfers.toString())
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      console.log("Config already initialized, fetching current state...")
      const config = await program.account.config.fetch(configPda)
      console.log("Config:")
      console.log("  Authority:", config.authority.toString())
      console.log("  Fee BPS:", config.feeBps)
      console.log("  Paused:", config.paused)
      console.log("  Total Transfers:", config.totalTransfers.toString())
    } else {
      throw err
    }
  }
}

main().catch(console.error)
