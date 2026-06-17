use anchor_lang::prelude::Pubkey;

pub const VAULT_CONFIG_SEED: &[u8] = b"vault_config";
pub const DEPOSIT_RECORD_SEED: &[u8] = b"deposit_record";
pub const VAULT_TOKEN_SEED: &[u8] = b"vault_token";
pub const FEE_TOKEN_SEED: &[u8] = b"fee_token";
pub const DEFAULT_REFUND_TIMEOUT: i64 = 86400;
pub const DEFAULT_FEE_BPS: u16 = 10;
pub const MAX_FEE_BPS: u16 = 100;

pub const VAULT_SOL_SEED: &[u8] = b"vault_sol";
pub const FEE_SOL_SEED: &[u8] = b"fee_sol";
/// Sentinel mint representing native SOL (zero / System-Program pubkey).
pub const NATIVE_SOL_MINT: Pubkey = Pubkey::new_from_array([0u8; 32]);

