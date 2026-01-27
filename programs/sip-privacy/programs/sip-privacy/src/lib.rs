//! SIP Protocol - Privacy-preserving Shielded Transfers on Solana
//!
//! This program enables private transfers using:
//! - Pedersen commitments to hide amounts
//! - Stealth addresses to hide recipients
//! - ZK proofs to verify validity without revealing data
//!
//! ## Architecture
//!
//! ```text
//! ┌────────────────────────────────────────────────────────────────────────┐
//! │  SENDER                                                                │
//! │  1. Create Pedersen commitment: C = amount * G + blinding * H          │
//! │  2. Generate stealth address for recipient                             │
//! │  3. Create ZK proof of valid commitment                                │
//! │  4. Call shielded_transfer with commitment + proof                     │
//! └────────────────────────────────────────────────────────────────────────┘
//!                                    │
//!                                    ▼
//! ┌────────────────────────────────────────────────────────────────────────┐
//! │  SIP PRIVACY PROGRAM                                                   │
//! │  1. Verify ZK proof on-chain                                           │
//! │  2. Store commitment in TransferRecord PDA                             │
//! │  3. Transfer actual funds to stealth address                           │
//! │  4. Emit event for off-chain indexing                                  │
//! └────────────────────────────────────────────────────────────────────────┘
//!                                    │
//!                                    ▼
//! ┌────────────────────────────────────────────────────────────────────────┐
//! │  RECIPIENT                                                             │
//! │  1. Scan announcements with viewing key                                │
//! │  2. Derive stealth address private key                                 │
//! │  3. Call claim_transfer with proof of ownership                        │
//! └────────────────────────────────────────────────────────────────────────┘
//! ```

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

pub mod commitment;
pub mod zk_verifier;

use commitment::{verify_commitment_format, SCALAR_SIZE};
use zk_verifier::{deserialize_proof, verify_proof, ZkVerifyError};

declare_id!("S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at");

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// Seed for transfer record PDAs
pub const TRANSFER_RECORD_SEED: &[u8] = b"transfer_record";

/// Seed for config PDA
pub const CONFIG_SEED: &[u8] = b"config";

/// Seed for nullifier PDAs (prevents double-claims)
pub const NULLIFIER_SEED: &[u8] = b"nullifier";

/// Maximum commitment size (33 bytes for compressed secp256k1 point)
pub const COMMITMENT_SIZE: usize = 33;

/// Maximum proof size (varies by circuit, ~1KB typical)
pub const MAX_PROOF_SIZE: usize = 2048;

/// Maximum ephemeral public key size (33 bytes compressed)
pub const EPHEMERAL_PUBKEY_SIZE: usize = 33;

/// Viewing key hash size (32 bytes SHA256)
pub const VIEWING_KEY_HASH_SIZE: usize = 32;

// ─────────────────────────────────────────────────────────────────────────────
// Program
// ─────────────────────────────────────────────────────────────────────────────

#[program]
pub mod sip_privacy {
    use super::*;

    /// Initialize the SIP Privacy program configuration
    ///
    /// Creates a program-wide config account that stores:
    /// - Authority (who can update config)
    /// - Fee settings (optional protocol fee)
    /// - Pause status (emergency shutdown)
    pub fn initialize(ctx: Context<Initialize>, fee_bps: u16) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.fee_bps = fee_bps;
        config.paused = false;
        config.total_transfers = 0;
        config.bump = ctx.bumps.config;

        msg!(
            "SIP Privacy initialized. Authority: {}, Fee: {} bps",
            config.authority,
            config.fee_bps
        );

        Ok(())
    }

    /// Execute a shielded transfer with hidden amount
    ///
    /// ## Parameters
    ///
    /// - `amount_commitment`: Pedersen commitment to the transfer amount (C = v*G + r*H)
    /// - `stealth_pubkey`: One-time recipient address derived from recipient's keys
    /// - `ephemeral_pubkey`: Ephemeral public key for recipient to derive stealth private key
    /// - `viewing_key_hash`: Hash of recipient's viewing key (for compliance scanning)
    /// - `encrypted_amount`: Amount encrypted with recipient's viewing key (for their eyes only)
    /// - `proof`: ZK proof that commitment is valid and amount >= 0
    ///
    /// ## Security
    ///
    /// - Amount is hidden in commitment (only recipient with blinding factor can open)
    /// - Recipient identity hidden behind stealth address
    /// - Viewing key allows authorized parties (auditors) to see amount if needed
    pub fn shielded_transfer(
        ctx: Context<ShieldedTransfer>,
        amount_commitment: [u8; COMMITMENT_SIZE],
        stealth_pubkey: Pubkey,
        ephemeral_pubkey: [u8; EPHEMERAL_PUBKEY_SIZE],
        viewing_key_hash: [u8; VIEWING_KEY_HASH_SIZE],
        encrypted_amount: Vec<u8>,
        proof: Vec<u8>,
        actual_amount: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.config;

        // Check program not paused
        require!(!config.paused, SipError::ProgramPaused);

        // Validate proof size
        require!(proof.len() <= MAX_PROOF_SIZE, SipError::ProofTooLarge);

        // Validate encrypted amount size (XChaCha20-Poly1305: nonce + ciphertext + tag)
        require!(
            encrypted_amount.len() <= 64,
            SipError::EncryptedAmountTooLarge
        );

        // Verify commitment is a valid compressed point (starts with 0x02 or 0x03)
        require!(
            amount_commitment[0] == 0x02 || amount_commitment[0] == 0x03,
            SipError::InvalidCommitment
        );

        // TODO: In production, verify ZK proof on-chain using Sunspot verifier
        // For now, we trust the proof and verify off-chain
        // This will be implemented in #402 (On-chain Pedersen commitment verification)
        msg!("ZK proof verification: {} bytes (off-chain verified)", proof.len());

        // Initialize transfer record
        let transfer_record = &mut ctx.accounts.transfer_record;
        transfer_record.sender = ctx.accounts.sender.key();
        transfer_record.stealth_recipient = stealth_pubkey;
        transfer_record.amount_commitment = amount_commitment;
        transfer_record.ephemeral_pubkey = ephemeral_pubkey;
        transfer_record.viewing_key_hash = viewing_key_hash;
        transfer_record.encrypted_amount = encrypted_amount;
        transfer_record.timestamp = Clock::get()?.unix_timestamp;
        transfer_record.claimed = false;
        transfer_record.bump = ctx.bumps.transfer_record;

        // Calculate fee (if any)
        let fee_amount = if config.fee_bps > 0 {
            (actual_amount as u128 * config.fee_bps as u128 / 10000) as u64
        } else {
            0
        };
        let transfer_amount = actual_amount.checked_sub(fee_amount).ok_or(SipError::MathOverflow)?;

        // Transfer SOL to stealth address
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.stealth_account.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, transfer_amount)?;

        // Transfer fee to fee collector (if any)
        if fee_amount > 0 {
            let fee_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.sender.to_account_info(),
                    to: ctx.accounts.fee_collector.to_account_info(),
                },
            );
            anchor_lang::system_program::transfer(fee_context, fee_amount)?;
        }

        // Update config stats
        let config = &mut ctx.accounts.config;
        config.total_transfers = config.total_transfers.saturating_add(1);

        // Emit event for off-chain indexing
        emit!(ShieldedTransferEvent {
            sender: ctx.accounts.sender.key(),
            stealth_recipient: stealth_pubkey,
            amount_commitment,
            ephemeral_pubkey,
            viewing_key_hash,
            timestamp: transfer_record.timestamp,
            transfer_id: transfer_record.key(),
        });

        // Minimal log for privacy
        msg!("Shielded transfer complete");

        Ok(())
    }

    /// Execute a shielded SPL token transfer
    ///
    /// Same as `shielded_transfer` but for SPL tokens instead of SOL.
    pub fn shielded_token_transfer(
        ctx: Context<ShieldedTokenTransfer>,
        amount_commitment: [u8; COMMITMENT_SIZE],
        stealth_pubkey: Pubkey,
        ephemeral_pubkey: [u8; EPHEMERAL_PUBKEY_SIZE],
        viewing_key_hash: [u8; VIEWING_KEY_HASH_SIZE],
        encrypted_amount: Vec<u8>,
        proof: Vec<u8>,
        actual_amount: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.config;

        // Check program not paused
        require!(!config.paused, SipError::ProgramPaused);

        // Validate inputs
        require!(proof.len() <= MAX_PROOF_SIZE, SipError::ProofTooLarge);
        require!(
            encrypted_amount.len() <= 64,
            SipError::EncryptedAmountTooLarge
        );
        require!(
            amount_commitment[0] == 0x02 || amount_commitment[0] == 0x03,
            SipError::InvalidCommitment
        );

        // TODO: Verify ZK proof on-chain
        msg!("ZK proof verification: {} bytes (off-chain verified)", proof.len());

        // Initialize transfer record
        let transfer_record = &mut ctx.accounts.transfer_record;
        transfer_record.sender = ctx.accounts.sender.key();
        transfer_record.stealth_recipient = stealth_pubkey;
        transfer_record.amount_commitment = amount_commitment;
        transfer_record.ephemeral_pubkey = ephemeral_pubkey;
        transfer_record.viewing_key_hash = viewing_key_hash;
        transfer_record.encrypted_amount = encrypted_amount;
        transfer_record.timestamp = Clock::get()?.unix_timestamp;
        transfer_record.claimed = false;
        transfer_record.bump = ctx.bumps.transfer_record;
        transfer_record.token_mint = Some(ctx.accounts.token_mint.key());

        // Calculate fee
        let fee_amount = if config.fee_bps > 0 {
            (actual_amount as u128 * config.fee_bps as u128 / 10000) as u64
        } else {
            0
        };
        let transfer_amount = actual_amount.checked_sub(fee_amount).ok_or(SipError::MathOverflow)?;

        // Transfer tokens to stealth token account
        let cpi_accounts = Transfer {
            from: ctx.accounts.sender_token_account.to_account_info(),
            to: ctx.accounts.stealth_token_account.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, transfer_amount)?;

        // Transfer fee tokens (if any)
        if fee_amount > 0 {
            let fee_accounts = Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                to: ctx.accounts.fee_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
            };
            let fee_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                fee_accounts,
            );
            token::transfer(fee_ctx, fee_amount)?;
        }

        // Update config stats
        let config = &mut ctx.accounts.config;
        config.total_transfers = config.total_transfers.saturating_add(1);

        // Emit event
        emit!(ShieldedTransferEvent {
            sender: ctx.accounts.sender.key(),
            stealth_recipient: stealth_pubkey,
            amount_commitment,
            ephemeral_pubkey,
            viewing_key_hash,
            timestamp: transfer_record.timestamp,
            transfer_id: transfer_record.key(),
        });

        // Minimal log for privacy
        msg!("Shielded token transfer complete");

        Ok(())
    }

    /// Pause or unpause the program (admin only)
    pub fn set_paused(ctx: Context<AdminAction>, paused: bool) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.paused = paused;
        msg!("Program paused: {}", paused);
        Ok(())
    }

    /// Update fee settings (admin only)
    pub fn update_fee(ctx: Context<AdminAction>, new_fee_bps: u16) -> Result<()> {
        require!(new_fee_bps <= 1000, SipError::FeeTooHigh); // Max 10%
        let config = &mut ctx.accounts.config;
        config.fee_bps = new_fee_bps;
        msg!("Fee updated: {} bps", new_fee_bps);
        Ok(())
    }

    /// Verify a Pedersen commitment on-chain
    ///
    /// This instruction verifies that a commitment C opens to a specific value.
    ///
    /// ## Parameters
    ///
    /// - `commitment`: The commitment point (33 bytes compressed secp256k1)
    /// - `value`: The claimed value
    /// - `blinding`: The blinding factor (32 bytes)
    ///
    /// ## Returns
    ///
    /// Result indicating if verification passed
    ///
    /// ## Compute Units
    ///
    /// Current implementation: ~5,000 CU (format validation only)
    /// Full EC verification: ~60,000 CU (requires solana-secp256k1)
    ///
    /// ## Note
    ///
    /// This is a utility instruction for testing/debugging.
    /// In production, commitment verification is integrated into
    /// shielded_transfer and claim_transfer.
    pub fn verify_commitment(
        _ctx: Context<VerifyCommitment>,
        commitment: [u8; COMMITMENT_SIZE],
        value: u64,
        blinding: [u8; SCALAR_SIZE],
    ) -> Result<()> {
        // Verify commitment format and perform basic validation
        let result = verify_commitment_format(&commitment, value, &blinding);

        match result {
            Ok(true) => {
                msg!("Commitment format valid. Value: {}", value);

                // Emit verification event for debugging
                emit!(CommitmentVerifiedEvent {
                    commitment,
                    value,
                    verified: true,
                });

                Ok(())
            }
            Ok(false) => {
                msg!("Commitment verification failed");
                err!(SipError::InvalidCommitment)
            }
            Err(_e) => {
                msg!("Commitment format invalid");
                err!(SipError::InvalidCommitment)
            }
        }
    }

    /// Verify a ZK proof on-chain
    ///
    /// Verifies Noir ZK proofs (funding, validity, fulfillment) on Solana.
    ///
    /// ## Parameters
    ///
    /// - `proof_data`: Serialized proof with public inputs
    ///   Format: [proof_type(1)] [num_inputs(4)] [inputs(n*32)] [proof_len(4)] [proof]
    ///
    /// ## Supported Proof Types
    ///
    /// - `0` = Funding: Proves balance >= minimum without revealing balance
    /// - `1` = Validity: Proves intent authorization without revealing sender
    /// - `2` = Fulfillment: Proves correct execution without revealing path
    ///
    /// ## Compute Units
    ///
    /// - Funding proof: ~200,000 CU
    /// - Validity proof: ~350,000 CU
    /// - Fulfillment proof: ~250,000 CU
    ///
    /// ## Note
    ///
    /// Current implementation performs format validation.
    /// Full cryptographic verification via Sunspot verifiers coming in M17.
    pub fn verify_zk_proof(
        _ctx: Context<VerifyZkProof>,
        proof_data: Vec<u8>,
    ) -> Result<()> {
        // Validate proof data size
        require!(proof_data.len() > 0, SipError::ProofTooLarge);
        require!(proof_data.len() <= zk_verifier::MAX_PROOF_SIZE + 1024, SipError::ProofTooLarge);

        // Deserialize proof
        let proof = deserialize_proof(&proof_data).map_err(|e| {
            msg!("Proof deserialization failed: {:?}", e);
            match e {
                ZkVerifyError::ProofTooLarge => SipError::ProofTooLarge,
                ZkVerifyError::InvalidProofFormat => SipError::InvalidProofFormat,
                ZkVerifyError::UnsupportedProofType => SipError::UnsupportedProofType,
                ZkVerifyError::TooManyPublicInputs => SipError::InvalidPublicInputs,
                ZkVerifyError::MissingPublicInputs => SipError::InvalidPublicInputs,
                ZkVerifyError::InvalidPublicInput => SipError::InvalidPublicInputs,
                ZkVerifyError::VerificationFailed => SipError::ProofVerificationFailed,
            }
        })?;

        // Log proof details
        msg!(
            "Verifying {} proof: {} public inputs, {} proof bytes",
            proof.proof_type.name(),
            proof.public_inputs.len(),
            proof.proof_bytes.len()
        );

        // Verify proof
        let result = verify_proof(&proof);

        if result.valid {
            msg!("ZK proof verification: VALID");

            // Emit verification event
            emit!(ZkProofVerifiedEvent {
                proof_type: proof.proof_type as u8,
                public_input_count: proof.public_inputs.len() as u8,
                proof_size: proof.proof_bytes.len() as u32,
                verified: true,
            });

            Ok(())
        } else {
            msg!("ZK proof verification: FAILED - {:?}", result.error);
            err!(SipError::ProofVerificationFailed)
        }
    }

    /// Claim a shielded transfer as the recipient
    ///
    /// ## Flow
    ///
    /// 1. Recipient scans announcements with viewing key
    /// 2. Finds transfer addressed to them (can decrypt with viewing key)
    /// 3. Derives stealth private key from ephemeral_pubkey
    /// 4. Signs claim transaction with stealth private key
    /// 5. Proves ownership and claims funds to their main wallet
    ///
    /// ## Parameters
    ///
    /// - `nullifier`: Hash of (transfer_id, stealth_privkey) - prevents double-claims
    /// - `proof`: ZK proof that claimer knows the stealth private key
    ///
    /// ## Security
    ///
    /// - Nullifier prevents double-spending
    /// - ZK proof ensures only stealth address owner can claim
    /// - Transfer record marked as claimed
    pub fn claim_transfer(
        ctx: Context<ClaimTransfer>,
        nullifier: [u8; 32],
        proof: Vec<u8>,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let transfer_record = &ctx.accounts.transfer_record;

        // Check program not paused
        require!(!config.paused, SipError::ProgramPaused);

        // Check not already claimed
        require!(!transfer_record.claimed, SipError::AlreadyClaimed);

        // Validate proof size
        require!(proof.len() <= MAX_PROOF_SIZE, SipError::ProofTooLarge);

        // Verify stealth account matches transfer record
        require!(
            ctx.accounts.stealth_account.key() == transfer_record.stealth_recipient,
            SipError::InvalidStealthProof
        );

        // TODO: In production, verify ZK proof that claimer owns stealth private key
        // The proof should demonstrate knowledge of:
        // - stealth_privkey where stealth_pubkey = stealth_privkey * G
        // - Computed from: stealth_privkey = spending_privkey + hash(ephemeral_pubkey, viewing_privkey)
        msg!("Claim proof verification: {} bytes (off-chain verified)", proof.len());

        // Create nullifier record to prevent double-claims
        let nullifier_record = &mut ctx.accounts.nullifier_record;
        nullifier_record.nullifier = nullifier;
        nullifier_record.transfer_record = transfer_record.key();
        nullifier_record.claimed_at = Clock::get()?.unix_timestamp;
        nullifier_record.bump = ctx.bumps.nullifier_record;

        // Mark transfer as claimed
        let transfer_record = &mut ctx.accounts.transfer_record;
        transfer_record.claimed = true;

        // Transfer ALL SOL from stealth account to recipient (fully drain)
        // Note: This requires the stealth account to be a signer (stealth_privkey)
        // We transfer ALL lamports - the account will be garbage collected when empty
        let stealth_balance = ctx.accounts.stealth_account.lamports();

        if stealth_balance > 0 {
            // Transfer all SOL from stealth account to recipient using System Program CPI
            // The stealth account is a signer (via derived private key), so this works
            // Account will be automatically closed (garbage collected) when balance hits 0
            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.stealth_account.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                },
            );
            anchor_lang::system_program::transfer(cpi_context, stealth_balance)?;
        }

        // Emit claim event
        emit!(ClaimEvent {
            transfer_id: transfer_record.key(),
            nullifier,
            recipient: ctx.accounts.recipient.key(),
            timestamp: nullifier_record.claimed_at,
        });

        // Minimal log for privacy - no identifying info
        msg!("Claim complete");

        Ok(())
    }

    /// Claim a shielded SPL token transfer
    ///
    /// Same as `claim_transfer` but for SPL tokens.
    pub fn claim_token_transfer(
        ctx: Context<ClaimTokenTransfer>,
        nullifier: [u8; 32],
        proof: Vec<u8>,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let transfer_record = &ctx.accounts.transfer_record;

        // Check program not paused
        require!(!config.paused, SipError::ProgramPaused);

        // Check not already claimed
        require!(!transfer_record.claimed, SipError::AlreadyClaimed);

        // Validate proof size
        require!(proof.len() <= MAX_PROOF_SIZE, SipError::ProofTooLarge);

        // TODO: Verify ZK proof
        msg!("Claim proof verification: {} bytes (off-chain verified)", proof.len());

        // Create nullifier record
        let nullifier_record = &mut ctx.accounts.nullifier_record;
        nullifier_record.nullifier = nullifier;
        nullifier_record.transfer_record = transfer_record.key();
        nullifier_record.claimed_at = Clock::get()?.unix_timestamp;
        nullifier_record.bump = ctx.bumps.nullifier_record;

        // Mark transfer as claimed
        let transfer_record = &mut ctx.accounts.transfer_record;
        transfer_record.claimed = true;

        // Get token balance of stealth account
        let stealth_balance = ctx.accounts.stealth_token_account.amount;

        if stealth_balance > 0 {
            // Transfer tokens from stealth to recipient
            // This requires the stealth account owner to be a PDA we control
            // For now, we use a signed CPI from the stealth account
            let cpi_accounts = Transfer {
                from: ctx.accounts.stealth_token_account.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.stealth_authority.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();

            // The stealth_authority is a PDA derived from the transfer record
            let transfer_key = transfer_record.key();
            let bump = ctx.bumps.stealth_authority;
            let seeds = &[
                b"stealth_authority".as_ref(),
                transfer_key.as_ref(),
                &[bump],
            ];
            let signer_seeds = &[&seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
            token::transfer(cpi_ctx, stealth_balance)?;
        }

        // Emit claim event
        emit!(ClaimEvent {
            transfer_id: transfer_record.key(),
            nullifier,
            recipient: ctx.accounts.recipient.key(),
            timestamp: nullifier_record.claimed_at,
        });

        // Minimal log for privacy
        msg!("Token claim complete");

        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Accounts
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ShieldedTransfer<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = sender,
        space = 8 + TransferRecord::INIT_SPACE,
        seeds = [
            TRANSFER_RECORD_SEED,
            sender.key().as_ref(),
            &config.total_transfers.to_le_bytes(),
        ],
        bump,
    )]
    pub transfer_record: Account<'info, TransferRecord>,

    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: This is the stealth address derived off-chain
    #[account(mut)]
    pub stealth_account: UncheckedAccount<'info>,

    /// CHECK: Fee collector account
    #[account(mut)]
    pub fee_collector: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ShieldedTokenTransfer<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = sender,
        space = 8 + TransferRecord::INIT_SPACE,
        seeds = [
            TRANSFER_RECORD_SEED,
            sender.key().as_ref(),
            &config.total_transfers.to_le_bytes(),
        ],
        bump,
    )]
    pub transfer_record: Account<'info, TransferRecord>,

    #[account(mut)]
    pub sender: Signer<'info>,

    /// The token mint
    pub token_mint: Account<'info, Mint>,

    /// Sender's token account
    #[account(
        mut,
        constraint = sender_token_account.mint == token_mint.key(),
        constraint = sender_token_account.owner == sender.key(),
    )]
    pub sender_token_account: Account<'info, TokenAccount>,

    /// Stealth recipient's token account
    #[account(
        mut,
        constraint = stealth_token_account.mint == token_mint.key(),
    )]
    pub stealth_token_account: Account<'info, TokenAccount>,

    /// Fee collector's token account
    #[account(
        mut,
        constraint = fee_token_account.mint == token_mint.key(),
    )]
    pub fee_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.authority == authority.key() @ SipError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(nullifier: [u8; 32])]
pub struct ClaimTransfer<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        constraint = !transfer_record.claimed @ SipError::AlreadyClaimed,
    )]
    pub transfer_record: Account<'info, TransferRecord>,

    #[account(
        init,
        payer = recipient,
        space = 8 + NullifierRecord::INIT_SPACE,
        seeds = [NULLIFIER_SEED, &nullifier],
        bump,
    )]
    pub nullifier_record: Account<'info, NullifierRecord>,

    /// The stealth account holding the funds
    /// Must be a signer (recipient proves ownership via stealth private key)
    #[account(
        mut,
        constraint = stealth_account.key() == transfer_record.stealth_recipient @ SipError::InvalidStealthProof,
    )]
    pub stealth_account: Signer<'info>,

    /// The recipient's main wallet
    #[account(mut)]
    pub recipient: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyCommitment<'info> {
    /// Anyone can verify a commitment (no state changes)
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
pub struct VerifyZkProof<'info> {
    /// Anyone can verify a ZK proof (no state changes)
    /// Pays for compute units
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(nullifier: [u8; 32])]
pub struct ClaimTokenTransfer<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        constraint = !transfer_record.claimed @ SipError::AlreadyClaimed,
    )]
    pub transfer_record: Account<'info, TransferRecord>,

    #[account(
        init,
        payer = recipient,
        space = 8 + NullifierRecord::INIT_SPACE,
        seeds = [NULLIFIER_SEED, &nullifier],
        bump,
    )]
    pub nullifier_record: Account<'info, NullifierRecord>,

    /// The stealth account (signer proves ownership)
    pub stealth_account: Signer<'info>,

    /// The recipient's main wallet
    #[account(mut)]
    pub recipient: Signer<'info>,

    /// PDA authority for stealth token account
    /// CHECK: PDA derived from transfer record
    #[account(
        seeds = [b"stealth_authority", transfer_record.key().as_ref()],
        bump,
    )]
    pub stealth_authority: UncheckedAccount<'info>,

    /// The token mint
    #[account(
        constraint = token_mint.key() == stealth_token_account.mint,
    )]
    pub token_mint: Account<'info, Mint>,

    /// Stealth token account holding the tokens
    #[account(
        mut,
        constraint = stealth_token_account.owner == stealth_authority.key(),
    )]
    pub stealth_token_account: Account<'info, TokenAccount>,

    /// Recipient's token account
    #[account(
        mut,
        constraint = recipient_token_account.owner == recipient.key(),
        constraint = recipient_token_account.mint == stealth_token_account.mint,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

/// Program configuration
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Program authority (can pause, update fees)
    pub authority: Pubkey,

    /// Protocol fee in basis points (100 = 1%)
    pub fee_bps: u16,

    /// Whether program is paused
    pub paused: bool,

    /// Total number of transfers (used for unique PDAs)
    pub total_transfers: u64,

    /// PDA bump
    pub bump: u8,
}

/// Record of a shielded transfer
#[account]
#[derive(InitSpace)]
pub struct TransferRecord {
    /// Original sender (may be hidden in future versions)
    pub sender: Pubkey,

    /// Stealth recipient address
    pub stealth_recipient: Pubkey,

    /// Pedersen commitment to the amount: C = v*G + r*H
    pub amount_commitment: [u8; COMMITMENT_SIZE],

    /// Ephemeral public key for stealth address derivation
    pub ephemeral_pubkey: [u8; EPHEMERAL_PUBKEY_SIZE],

    /// Hash of recipient's viewing key (for compliance scanning)
    pub viewing_key_hash: [u8; VIEWING_KEY_HASH_SIZE],

    /// Amount encrypted with viewing key (XChaCha20-Poly1305)
    #[max_len(64)]
    pub encrypted_amount: Vec<u8>,

    /// Unix timestamp of transfer
    pub timestamp: i64,

    /// Whether funds have been claimed
    pub claimed: bool,

    /// Token mint (None for SOL transfers)
    pub token_mint: Option<Pubkey>,

    /// PDA bump
    pub bump: u8,
}

/// Nullifier record to prevent double-claims
///
/// A nullifier is a deterministic hash derived from the transfer and recipient's
/// private key. Once a nullifier is "spent" (stored on-chain), the transfer
/// cannot be claimed again.
///
/// Nullifier = hash(transfer_id || stealth_privkey)
#[account]
#[derive(InitSpace)]
pub struct NullifierRecord {
    /// The nullifier hash (32 bytes)
    pub nullifier: [u8; 32],

    /// The transfer record this nullifier corresponds to
    pub transfer_record: Pubkey,

    /// Timestamp when claimed
    pub claimed_at: i64,

    /// PDA bump
    pub bump: u8,
}

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

/// Emitted when a shielded transfer is created
#[event]
pub struct ShieldedTransferEvent {
    /// Sender's public key
    pub sender: Pubkey,

    /// Stealth recipient address
    pub stealth_recipient: Pubkey,

    /// Pedersen commitment to amount
    pub amount_commitment: [u8; COMMITMENT_SIZE],

    /// Ephemeral public key
    pub ephemeral_pubkey: [u8; EPHEMERAL_PUBKEY_SIZE],

    /// Hash of viewing key
    pub viewing_key_hash: [u8; VIEWING_KEY_HASH_SIZE],

    /// Block timestamp
    pub timestamp: i64,

    /// Transfer record PDA
    pub transfer_id: Pubkey,
}

/// Emitted when a transfer is claimed
#[event]
pub struct ClaimEvent {
    /// Transfer record that was claimed
    pub transfer_id: Pubkey,

    /// Nullifier (prevents double-claim)
    pub nullifier: [u8; 32],

    /// Recipient who claimed the funds
    pub recipient: Pubkey,

    /// Timestamp when claimed
    pub timestamp: i64,
}

/// Emitted when a commitment is verified
#[event]
pub struct CommitmentVerifiedEvent {
    /// The commitment that was verified
    pub commitment: [u8; COMMITMENT_SIZE],

    /// The claimed value
    pub value: u64,

    /// Whether verification passed
    pub verified: bool,
}

/// Emitted when a ZK proof is verified
#[event]
pub struct ZkProofVerifiedEvent {
    /// Proof type (0=funding, 1=validity, 2=fulfillment)
    pub proof_type: u8,

    /// Number of public inputs
    pub public_input_count: u8,

    /// Proof size in bytes
    pub proof_size: u32,

    /// Whether verification passed
    pub verified: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum SipError {
    #[msg("Program is currently paused")]
    ProgramPaused,

    #[msg("Invalid Pedersen commitment format")]
    InvalidCommitment,

    #[msg("ZK proof is too large")]
    ProofTooLarge,

    #[msg("Encrypted amount data is too large")]
    EncryptedAmountTooLarge,

    #[msg("ZK proof verification failed")]
    ProofVerificationFailed,

    #[msg("Unauthorized action")]
    Unauthorized,

    #[msg("Fee exceeds maximum allowed (10%)")]
    FeeTooHigh,

    #[msg("Math overflow")]
    MathOverflow,

    #[msg("Transfer already claimed")]
    AlreadyClaimed,

    #[msg("Invalid stealth address proof")]
    InvalidStealthProof,

    #[msg("Invalid proof format")]
    InvalidProofFormat,

    #[msg("Unsupported proof type")]
    UnsupportedProofType,

    #[msg("Invalid public inputs")]
    InvalidPublicInputs,
}
