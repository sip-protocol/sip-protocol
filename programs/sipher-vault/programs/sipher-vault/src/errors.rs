use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
  #[msg("Program is paused")]
  ProgramPaused,
  #[msg("Unauthorized: not the vault authority")]
  Unauthorized,
  #[msg("Insufficient balance for this operation")]
  InsufficientBalance,
  #[msg("Math overflow")]
  MathOverflow,
  #[msg("Deposit amount must be greater than zero")]
  ZeroDeposit,
  #[msg("Refund timeout has not expired yet")]
  RefundNotExpired,
  #[msg("No balance to refund")]
  NothingToRefund,
  #[msg("Fee rate exceeds maximum allowed")]
  FeeTooHigh,
  #[msg("No fees to collect")]
  NoFeesToCollect,
  #[msg("Invalid token mint")]
  InvalidMint,
  #[msg("Balance locked by scheduled operations")]
  BalanceLocked,
}
