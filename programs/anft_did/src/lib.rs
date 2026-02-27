use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod anft_did {
    use super::*;

    /// Register a new DID for the signing wallet.
    /// Creates a DidProfile PDA seeded by ["did", username] and a
    /// WalletLookup PDA seeded by ["wallet-did", signer].
    pub fn register_did(ctx: Context<RegisterDid>, username: String) -> Result<()> {
        // ── Validate username ──
        require!(username.len() >= 3, AnftError::UsernameTooShort);
        require!(username.len() <= 32, AnftError::UsernameTooLong);
        require!(
            username
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'),
            AnftError::UsernameInvalidChars
        );

        let profile = &mut ctx.accounts.did_profile;
        let lookup = &mut ctx.accounts.wallet_lookup;
        let clock = Clock::get()?;

        // Set DidProfile fields
        profile.pda_address = profile.key();
        profile.username = username;
        profile.did = format!("did:anft:{}", profile.pda_address);
        profile.current_wallet = ctx.accounts.signer.key();
        profile.original_wallet = ctx.accounts.signer.key();
        profile.created_at = clock.unix_timestamp;
        profile.attestation_count = 0;
        profile.bump = ctx.bumps.did_profile;

        // Set WalletLookup fields
        lookup.wallet = ctx.accounts.signer.key();
        lookup.pda_address = profile.key();
        lookup.bump = ctx.bumps.wallet_lookup;

        Ok(())
    }

    /// Transfer DID ownership to a new wallet.
    /// Closes the old WalletLookup, creates a new one for new_wallet,
    /// and updates DidProfile.current_wallet.
    pub fn transfer_did(ctx: Context<TransferDid>, new_wallet: Pubkey) -> Result<()> {
        let profile = &mut ctx.accounts.did_profile;
        let new_lookup = &mut ctx.accounts.new_wallet_lookup;

        // Update DidProfile
        profile.current_wallet = new_wallet;

        // Set new WalletLookup fields
        new_lookup.wallet = new_wallet;
        new_lookup.pda_address = profile.key();
        new_lookup.bump = ctx.bumps.new_wallet_lookup;

        // old_wallet_lookup is closed via close = signer constraint

        Ok(())
    }

    /// Increment the attestation count on a DidProfile.
    /// Called atomically inside the mint transaction.
    pub fn increment_attestation_count(ctx: Context<IncrementAttestation>) -> Result<()> {
        let profile = &mut ctx.accounts.did_profile;
        profile.attestation_count = profile
            .attestation_count
            .checked_add(1)
            .ok_or(AnftError::Overflow)?;
        Ok(())
    }
}

// ═══════════════════════════════════════════════════
// ACCOUNTS
// ═══════════════════════════════════════════════════

#[account]
pub struct DidProfile {
    /// This account's own public key – the canonical DID identifier.
    pub pda_address: Pubkey,        // 32
    /// Human-friendly display label (max 32 chars).
    pub username: String,           // 4 + 32 = 36
    /// Full DID string: "did:anft:<pda_address>"
    pub did: String,                // 4 + 64 = 68  (base58 pubkey ≤ 44 chars, padded)
    /// Wallet that currently owns this DID.
    pub current_wallet: Pubkey,     // 32
    /// Wallet that first registered this DID.
    pub original_wallet: Pubkey,    // 32
    /// Unix timestamp of creation.
    pub created_at: i64,            // 8
    /// Number of NFTs minted under this DID.
    pub attestation_count: u64,     // 8
    /// PDA bump seed.
    pub bump: u8,                   // 1
}

impl DidProfile {
    // 8 (discriminator) + 32 + 36 + 68 + 32 + 32 + 8 + 8 + 1 = 225
    // Add generous padding for string length variance
    pub const MAX_SIZE: usize = 8 + 32 + (4 + 32) + (4 + 64) + 32 + 32 + 8 + 8 + 1;
}

#[account]
pub struct WalletLookup {
    /// The wallet public key.
    pub wallet: Pubkey,       // 32
    /// The DidProfile PDA address this wallet owns.
    pub pda_address: Pubkey,  // 32
    /// PDA bump seed.
    pub bump: u8,             // 1
}

impl WalletLookup {
    // 8 (discriminator) + 32 + 32 + 1 = 73
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 1;
}

// ═══════════════════════════════════════════════════
// INSTRUCTION CONTEXTS
// ═══════════════════════════════════════════════════

#[derive(Accounts)]
#[instruction(username: String)]
pub struct RegisterDid<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = DidProfile::MAX_SIZE,
        seeds = [b"did", username.as_bytes()],
        bump,
    )]
    pub did_profile: Account<'info, DidProfile>,

    #[account(
        init,
        payer = signer,
        space = WalletLookup::MAX_SIZE,
        seeds = [b"wallet-did", signer.key().as_ref()],
        bump,
    )]
    pub wallet_lookup: Account<'info, WalletLookup>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(new_wallet: Pubkey)]
pub struct TransferDid<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        constraint = signer.key() == did_profile.current_wallet @ AnftError::Unauthorized,
    )]
    pub did_profile: Account<'info, DidProfile>,

    #[account(
        mut,
        seeds = [b"wallet-did", signer.key().as_ref()],
        bump = old_wallet_lookup.bump,
        close = signer,
    )]
    pub old_wallet_lookup: Account<'info, WalletLookup>,

    #[account(
        init,
        payer = signer,
        space = WalletLookup::MAX_SIZE,
        seeds = [b"wallet-did", new_wallet.as_ref()],
        bump,
    )]
    pub new_wallet_lookup: Account<'info, WalletLookup>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct IncrementAttestation<'info> {
    pub signer: Signer<'info>,

    #[account(
        mut,
        constraint = signer.key() == did_profile.current_wallet @ AnftError::Unauthorized,
    )]
    pub did_profile: Account<'info, DidProfile>,
}

// ═══════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════

#[error_code]
pub enum AnftError {
    #[msg("Username must be at least 3 characters")]
    UsernameTooShort,
    #[msg("Username must be at most 32 characters")]
    UsernameTooLong,
    #[msg("Username must be lowercase alphanumeric and hyphens only")]
    UsernameInvalidChars,
    #[msg("This wallet already has a registered DID")]
    WalletAlreadyHasDid,
    #[msg("Unauthorized: signer is not the current wallet owner")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
}
