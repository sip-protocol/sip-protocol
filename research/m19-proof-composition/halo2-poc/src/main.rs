//! SIP Protocol Halo2 Proof-of-Concept
//!
//! Demonstrates:
//! 1. Basic Halo2 circuit construction
//! 2. Custom gates for range checks
//! 3. Proof generation and verification
//! 4. Recursive proof concepts (accumulation)

use anyhow::Result;
use clap::{Parser, Subcommand};

mod circuit;
mod commitment;
mod recursion;


#[derive(Parser)]
#[command(name = "sip-halo2-poc")]
#[command(about = "SIP Protocol Halo2 Proof-of-Concept")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run the simple multiplication circuit demo
    Simple {
        /// Value for a
        #[arg(short, long, default_value = "3")]
        a: u64,
        /// Value for b
        #[arg(short, long, default_value = "4")]
        b: u64,
    },
    /// Run the commitment circuit demo (SIP-relevant)
    Commitment {
        /// Amount to commit
        #[arg(short, long, default_value = "1000")]
        amount: u64,
        /// Blinding factor
        #[arg(short, long, default_value = "42")]
        blinding: u64,
    },
    /// Demonstrate recursive accumulation
    Recursion {
        /// Number of proofs to accumulate
        #[arg(short, long, default_value = "3")]
        count: usize,
    },
    /// Run benchmarks
    Bench {
        /// Circuit size (log2 of rows)
        #[arg(short, long, default_value = "10")]
        k: u32,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Simple { a, b } => {
            println!("╔════════════════════════════════════════════════════════════╗");
            println!("║     SIP HALO2 POC - Simple Multiplication Circuit          ║");
            println!("╚════════════════════════════════════════════════════════════╝");
            println!();
            circuit::run_simple_demo(a, b)?;
        }
        Commands::Commitment { amount, blinding } => {
            println!("╔════════════════════════════════════════════════════════════╗");
            println!("║     SIP HALO2 POC - Commitment Circuit (SIP-Relevant)      ║");
            println!("╚════════════════════════════════════════════════════════════╝");
            println!();
            commitment::run_commitment_demo(amount, blinding)?;
        }
        Commands::Recursion { count } => {
            println!("╔════════════════════════════════════════════════════════════╗");
            println!("║     SIP HALO2 POC - Recursive Accumulation Demo            ║");
            println!("╚════════════════════════════════════════════════════════════╝");
            println!();
            recursion::run_recursion_demo(count)?;
        }
        Commands::Bench { k } => {
            println!("╔════════════════════════════════════════════════════════════╗");
            println!("║     SIP HALO2 POC - Performance Benchmarks                 ║");
            println!("╚════════════════════════════════════════════════════════════╝");
            println!();
            circuit::run_benchmarks(k)?;
        }
    }

    Ok(())
}
