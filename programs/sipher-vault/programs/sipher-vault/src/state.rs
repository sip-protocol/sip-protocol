use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VaultConfig {
  pub authority: Pubkey,
  pub fee_bps: u16,
  pub refund_timeout: i64,
  pub paused: bool,
  pub total_deposits: u64,
  pub total_depositors: u64,
  pub bump: u8,
  /// Pending authority for the two-step authority transfer (None = no transfer
  /// in flight). Set by `update_authority`, promoted/cleared by `accept_authority`.
  /// Trailing field so the fixed-offset fields above keep their byte positions.
  pub pending_authority: Option<Pubkey>,
}

#[account]
#[derive(InitSpace)]
pub struct DepositRecord {
  pub depositor: Pubkey,
  pub token_mint: Pubkey,
  pub balance: u64,
  pub cumulative_volume: u64,
  pub last_deposit_at: i64,
  pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SolVault {
  pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SolFee {
  pub bump: u8,
}
