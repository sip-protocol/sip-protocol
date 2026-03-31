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
}

#[account]
#[derive(InitSpace)]
pub struct DepositRecord {
  pub depositor: Pubkey,
  pub token_mint: Pubkey,
  pub balance: u64,
  pub locked_amount: u64,
  pub cumulative_volume: u64,
  pub last_deposit_at: i64,
  pub bump: u8,
}
