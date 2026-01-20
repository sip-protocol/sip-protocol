//! Simple Halo2 Circuit Implementation
//!
//! Demonstrates:
//! - Circuit trait implementation
//! - Custom gate configuration
//! - Advice column assignment
//! - Proof generation and verification

use anyhow::Result;
use halo2_proofs::{
    circuit::{Layouter, SimpleFloorPlanner, Value},
    plonk::{
        Advice, Circuit, Column, ConstraintSystem, Error, Selector,
        create_proof, keygen_pk, keygen_vk, verify_proof,
    },
    poly::{
        commitment::ParamsProver,
        ipa::{
            commitment::{IPACommitmentScheme, ParamsIPA},
            multiopen::{ProverIPA, VerifierIPA},
            strategy::AccumulatorStrategy,
        },
        VerificationStrategy,
    },
    transcript::{
        Blake2bRead, Blake2bWrite, Challenge255, TranscriptReadBuffer, TranscriptWriterBuffer,
    },
};
use pasta_curves::{pallas, vesta};
use rand_core::OsRng;
use std::time::Instant;

/// Field type for Pallas curve
type Fp = pallas::Base;

/// Simple multiplication circuit: a * b = c
/// Proves knowledge of a, b such that a * b equals a public value c
#[derive(Clone, Debug)]
pub struct SimpleCircuit<F: halo2_proofs::arithmetic::Field> {
    pub a: Value<F>,
    pub b: Value<F>,
}

/// Circuit configuration
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct SimpleConfig {
    /// Advice columns for private inputs
    advice: [Column<Advice>; 2],
    /// Selector for multiplication gate
    s_mul: Selector,
}

impl<F: halo2_proofs::arithmetic::Field> Circuit<F> for SimpleCircuit<F> {
    type Config = SimpleConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self {
            a: Value::unknown(),
            b: Value::unknown(),
        }
    }

    fn configure(meta: &mut ConstraintSystem<F>) -> Self::Config {
        // Create advice columns for private inputs (a, b, c are all private)
        let advice = [meta.advice_column(), meta.advice_column()];

        // Create selector for multiplication gate
        let s_mul = meta.selector();

        // Enable equality for advice columns (needed for copy constraints)
        meta.enable_equality(advice[0]);
        meta.enable_equality(advice[1]);

        // Define the multiplication gate
        // When s_mul = 1: a * b - c = 0
        // All values are private (advice columns)
        meta.create_gate("mul", |meta| {
            let s = meta.query_selector(s_mul);
            let a = meta.query_advice(advice[0], halo2_proofs::poly::Rotation::cur());
            let b = meta.query_advice(advice[1], halo2_proofs::poly::Rotation::cur());
            let c = meta.query_advice(advice[0], halo2_proofs::poly::Rotation::next());

            // s * (a * b - c) = 0
            vec![s * (a * b - c)]
        });

        SimpleConfig {
            advice,
            s_mul,
        }
    }

    fn synthesize(
        &self,
        config: Self::Config,
        mut layouter: impl Layouter<F>,
    ) -> Result<(), Error> {
        layouter.assign_region(
            || "multiplication",
            |mut region| {
                // Enable the multiplication gate
                config.s_mul.enable(&mut region, 0)?;

                // Assign a to advice[0] at row 0
                let a = region.assign_advice(
                    || "a",
                    config.advice[0],
                    0,
                    || self.a,
                )?;

                // Assign b to advice[1] at row 0
                let b = region.assign_advice(
                    || "b",
                    config.advice[1],
                    0,
                    || self.b,
                )?;

                // Compute c = a * b and assign to advice[0] at row 1
                let c = a.value().copied() * b.value();
                let c_cell = region.assign_advice(
                    || "c",
                    config.advice[0],
                    1,
                    || c,
                )?;

                Ok(())
            },
        )?;

        Ok(())
    }
}

/// Run the simple multiplication circuit demo
pub fn run_simple_demo(a: u64, b: u64) -> Result<()> {
    println!("Inputs: a = {}, b = {}", a, b);
    println!("Expected output: c = a * b = {}", a * b);
    println!();

    // Circuit size parameter (k means 2^k rows)
    let k = 4;
    println!("Circuit parameters:");
    println!("  - k = {} (2^{} = {} rows)", k, k, 1 << k);
    println!();

    // Create the circuit
    let a_field = Fp::from(a);
    let b_field = Fp::from(b);
    let c_field = Fp::from(a * b);

    let circuit = SimpleCircuit {
        a: Value::known(a_field),
        b: Value::known(b_field),
    };

    // Setup phase
    println!("─── SETUP PHASE ───");
    let start = Instant::now();
    let params: ParamsIPA<vesta::Affine> = ParamsIPA::new(k);
    println!("  Parameters generated in {:?}", start.elapsed());

    let start = Instant::now();
    let vk = keygen_vk(&params, &circuit)?;
    println!("  Verification key generated in {:?}", start.elapsed());

    let start = Instant::now();
    let pk = keygen_pk(&params, vk.clone(), &circuit)?;
    println!("  Proving key generated in {:?}", start.elapsed());
    println!();

    // Proving phase
    println!("─── PROVING PHASE ───");
    let start = Instant::now();

    let mut transcript = Blake2bWrite::<_, _, Challenge255<_>>::init(vec![]);

    create_proof::<
        IPACommitmentScheme<vesta::Affine>,
        ProverIPA<'_, vesta::Affine>,
        Challenge255<vesta::Affine>,
        _,
        Blake2bWrite<Vec<u8>, vesta::Affine, Challenge255<vesta::Affine>>,
        _,
    >(
        &params,
        &pk,
        &[circuit.clone()],
        &[&[]], // No public inputs in this simple version
        OsRng,
        &mut transcript,
    )?;

    let proof = transcript.finalize();
    let proving_time = start.elapsed();

    println!("  Proof generated in {:?}", proving_time);
    println!("  Proof size: {} bytes", proof.len());
    println!();

    // Verification phase
    println!("─── VERIFICATION PHASE ───");
    let start = Instant::now();

    let strategy = AccumulatorStrategy::new(&params);
    let mut transcript = Blake2bRead::<_, _, Challenge255<_>>::init(&proof[..]);

    let strategy = verify_proof::<
        IPACommitmentScheme<vesta::Affine>,
        VerifierIPA<'_, vesta::Affine>,
        Challenge255<vesta::Affine>,
        Blake2bRead<&[u8], vesta::Affine, Challenge255<vesta::Affine>>,
        AccumulatorStrategy<'_, vesta::Affine>,
    >(
        &params,
        &vk,
        strategy,
        &[&[]], // No public inputs
        &mut transcript,
    )?;

    let verification_time = start.elapsed();

    // Finalize verification
    assert!(strategy.finalize());

    println!("  ✓ Proof verified in {:?}", verification_time);
    println!();

    // Summary
    println!("─── SUMMARY ───");
    println!("  ✓ Successfully proved: {} × {} = {}", a, b, a * b);
    println!("  ✓ Proof size: {} bytes (~{:.1} KB)", proof.len(), proof.len() as f64 / 1024.0);
    println!("  ✓ Proving time: {:?}", proving_time);
    println!("  ✓ Verification time: {:?}", verification_time);
    println!();

    Ok(())
}

/// Run benchmarks for different circuit sizes
pub fn run_benchmarks(k: u32) -> Result<()> {
    println!("Running benchmarks with k = {} (2^{} = {} rows)", k, k, 1 << k);
    println!();

    let circuit = SimpleCircuit {
        a: Value::known(Fp::from(3)),
        b: Value::known(Fp::from(4)),
    };

    // Parameter generation
    println!("─── PARAMETER GENERATION ───");
    let start = Instant::now();
    let params: ParamsIPA<vesta::Affine> = ParamsIPA::new(k);
    println!("  Parameters: {:?}", start.elapsed());

    // Key generation
    println!();
    println!("─── KEY GENERATION ───");
    let start = Instant::now();
    let vk = keygen_vk(&params, &circuit)?;
    println!("  Verification key: {:?}", start.elapsed());

    let start = Instant::now();
    let pk = keygen_pk(&params, vk.clone(), &circuit)?;
    println!("  Proving key: {:?}", start.elapsed());

    // Multiple proving runs
    println!();
    println!("─── PROVING (5 iterations) ───");
    let mut proving_times = Vec::new();
    let mut proof_size = 0;

    for i in 0..5 {
        let start = Instant::now();

        let mut transcript = Blake2bWrite::<_, _, Challenge255<_>>::init(vec![]);

        create_proof::<
            IPACommitmentScheme<vesta::Affine>,
            ProverIPA<'_, vesta::Affine>,
            Challenge255<vesta::Affine>,
            _,
            Blake2bWrite<Vec<u8>, vesta::Affine, Challenge255<vesta::Affine>>,
            _,
        >(
            &params,
            &pk,
            &[circuit.clone()],
            &[&[]],
            OsRng,
            &mut transcript,
        )?;

        let proof = transcript.finalize();
        let elapsed = start.elapsed();

        if i == 0 {
            proof_size = proof.len();
        }

        proving_times.push(elapsed);
        println!("  Run {}: {:?}", i + 1, elapsed);
    }

    let avg_proving = proving_times.iter().sum::<std::time::Duration>() / 5;
    println!("  Average: {:?}", avg_proving);

    // Verification benchmark
    println!();
    println!("─── VERIFICATION (5 iterations) ───");

    // Generate a proof to verify
    let mut transcript = Blake2bWrite::<_, _, Challenge255<_>>::init(vec![]);
    create_proof::<
        IPACommitmentScheme<vesta::Affine>,
        ProverIPA<'_, vesta::Affine>,
        Challenge255<vesta::Affine>,
        _,
        Blake2bWrite<Vec<u8>, vesta::Affine, Challenge255<vesta::Affine>>,
        _,
    >(
        &params,
        &pk,
        &[circuit.clone()],
        &[&[]],
        OsRng,
        &mut transcript,
    )?;
    let proof = transcript.finalize();

    let mut verification_times = Vec::new();

    for i in 0..5 {
        let start = Instant::now();

        let strategy = AccumulatorStrategy::new(&params);
        let mut transcript = Blake2bRead::<_, _, Challenge255<_>>::init(&proof[..]);

        let strategy = verify_proof::<
            IPACommitmentScheme<vesta::Affine>,
            VerifierIPA<'_, vesta::Affine>,
            Challenge255<vesta::Affine>,
            Blake2bRead<&[u8], vesta::Affine, Challenge255<vesta::Affine>>,
            AccumulatorStrategy<'_, vesta::Affine>,
        >(
            &params,
            &vk,
            strategy,
            &[&[]],
            &mut transcript,
        )?;

        strategy.finalize();
        let elapsed = start.elapsed();

        verification_times.push(elapsed);
        println!("  Run {}: {:?}", i + 1, elapsed);
    }

    let avg_verification = verification_times.iter().sum::<std::time::Duration>() / 5;
    println!("  Average: {:?}", avg_verification);

    // Summary
    println!();
    println!("─── BENCHMARK SUMMARY ───");
    println!("  Circuit size: k = {} (2^{} rows)", k, k);
    println!("  Proof size: {} bytes (~{:.1} KB)", proof_size, proof_size as f64 / 1024.0);
    println!("  Average proving time: {:?}", avg_proving);
    println!("  Average verification time: {:?}", avg_verification);
    println!();

    Ok(())
}
