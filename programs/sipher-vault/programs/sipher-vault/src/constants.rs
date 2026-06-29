use anchor_lang::prelude::Pubkey;

pub const VAULT_CONFIG_SEED: &[u8] = b"vault_config";
pub const DEPOSIT_RECORD_SEED: &[u8] = b"deposit_record";
pub const VAULT_TOKEN_SEED: &[u8] = b"vault_token";
pub const FEE_TOKEN_SEED: &[u8] = b"fee_token";
pub const DEFAULT_REFUND_TIMEOUT: i64 = 86400;
pub const MAX_FEE_TENTHS_BPS: u16 = 1000; // 1% cap (1000 × 0.1 bps)
/// Fee denominator. `fee = amount · fee_tenths_bps / FEE_TENTHS_BPS_DENOMINATOR`
/// (unit = 0.1 bps → 1000 tenths-bps = 1% = the MAX_FEE_TENTHS_BPS cap).
pub const FEE_TENTHS_BPS_DENOMINATOR: u128 = 100_000;

pub const VAULT_SOL_SEED: &[u8] = b"vault_sol";
pub const FEE_SOL_SEED: &[u8] = b"fee_sol";
/// Sentinel mint representing native SOL (zero / System-Program pubkey).
pub const NATIVE_SOL_MINT: Pubkey = Pubkey::new_from_array([0u8; 32]);

/// Byte length of the legacy (pre-M1) VaultConfig account: 8-byte discriminator
/// plus the fixed fields, WITHOUT the trailing `pending_authority: Option<Pubkey>`
/// added by the B6 M1 hardening. `migrate_config` grows accounts of exactly this
/// size to the current `8 + VaultConfig::INIT_SPACE` (101 bytes).
pub const LEGACY_VAULT_CONFIG_LEN: usize = 8 + 32 + 2 + 8 + 1 + 8 + 8 + 1; // = 68
