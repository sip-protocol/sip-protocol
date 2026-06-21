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
  #[msg("CPI to SIP Privacy program failed")]
  AnnouncementCpiFailed,
  #[msg("Mint carries an unsupported Token-2022 extension")]
  UnsupportedMintExtension,
  #[msg("Operation would drain a SOL PDA below its rent-exempt minimum")]
  RentReserveViolation,
  #[msg("Encrypted amount exceeds the 64-byte maximum")]
  EncryptedAmountTooLong,
  #[msg("Config account is not a migratable legacy layout")]
  InvalidConfigAccount,
}
