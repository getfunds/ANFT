use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("8fpA4QsK2kwNd9JxqXd2S23FsspmFiKStmKYNBzGE8bK");

#[program]
pub mod anft_marketplace {
    use super::*;

    pub fn initialize_marketplace(ctx: Context<InitializeMarketplace>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 1000, MarketplaceError::FeeTooHigh);

        let marketplace = &mut ctx.accounts.marketplace;
        marketplace.admin = ctx.accounts.admin.key();
        marketplace.fee_recipient = ctx.accounts.fee_recipient.key();
        marketplace.fee_bps = fee_bps;
        marketplace.paused = false;
        marketplace.listing_count = 0;
        marketplace.bump = ctx.bumps.marketplace;

        emit!(MarketplaceInitialized {
            admin: marketplace.admin,
            fee_recipient: marketplace.fee_recipient,
            fee_bps,
        });

        Ok(())
    }

    pub fn list_nft(
        ctx: Context<ListNft>,
        price: u64,
        duration: i64,
        is_auction: bool,
    ) -> Result<()> {
        require!(
            !ctx.accounts.marketplace.paused,
            MarketplaceError::MarketplacePaused
        );
        require!(price > 0, MarketplaceError::PriceMustBePositive);
        require!(duration >= 86400, MarketplaceError::DurationTooShort);

        let listing = &mut ctx.accounts.listing;

        // If the listing PDA already exists from a previous sale, it must be inactive
        require!(!listing.is_active, MarketplaceError::ListingNotActive);

        // Verify the seller actually owns the NFT
        require!(
            ctx.accounts.seller_token_account.amount == 1,
            MarketplaceError::SellerDoesNotOwnNft
        );

        let clock = Clock::get()?;

        listing.seller = ctx.accounts.seller.key();
        listing.nft_mint = ctx.accounts.nft_mint.key();
        listing.price = price;
        listing.expiration_time = clock
            .unix_timestamp
            .checked_add(duration)
            .ok_or(MarketplaceError::Overflow)?;
        listing.is_active = true;
        listing.is_auction = is_auction;
        listing.highest_bid = 0;
        listing.highest_bidder = Pubkey::default();
        listing.created_at = clock.unix_timestamp;
        listing.bump = ctx.bumps.listing;

        let escrow = &mut ctx.accounts.escrow;
        escrow.nft_mint = ctx.accounts.nft_mint.key();
        escrow.bump = ctx.bumps.escrow;

        // Transfer NFT from seller to escrow token account
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    to: ctx.accounts.escrow_token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            1,
        )?;

        let marketplace = &mut ctx.accounts.marketplace;
        marketplace.listing_count = marketplace
            .listing_count
            .checked_add(1)
            .ok_or(MarketplaceError::Overflow)?;

        emit!(ListingCreated {
            seller: listing.seller,
            nft_mint: listing.nft_mint,
            price,
            is_auction,
            expiration_time: listing.expiration_time,
        });

        Ok(())
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        let is_seller = ctx.accounts.authority.key() == listing.seller;
        let is_admin = ctx.accounts.authority.key() == ctx.accounts.marketplace.admin;
        require!(is_seller || is_admin, MarketplaceError::Unauthorized);
        require!(listing.is_active, MarketplaceError::ListingNotActive);

        let nft_mint_key = ctx.accounts.nft_mint.key();
        let escrow_seeds: &[&[u8]] = &[
            b"escrow",
            nft_mint_key.as_ref(),
            &[ctx.accounts.escrow.bump],
        ];

        // Transfer NFT back from escrow to seller
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.seller_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                &[escrow_seeds],
            ),
            1,
        )?;

        emit!(ListingCancelled {
            nft_mint: listing.nft_mint,
            seller: listing.seller,
        });

        // listing is closed via the `close = authority` constraint on CancelListing
        Ok(())
    }

    pub fn buy_nft(ctx: Context<BuyNft>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(listing.is_active, MarketplaceError::ListingNotActive);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < listing.expiration_time,
            MarketplaceError::ListingExpired
        );
        require!(
            ctx.accounts.buyer.key() != listing.seller,
            MarketplaceError::CannotBuyOwnListing
        );

        if !listing.is_auction {
            // Fixed price — exact payment
        } else {
            // Auction — use bid flow instead
            return Err(MarketplaceError::UseAuctionBidding.into());
        }

        let price = listing.price;
        let fee_bps = ctx.accounts.marketplace.fee_bps as u64;
        let fee = price.checked_mul(fee_bps).ok_or(MarketplaceError::Overflow)? / 10_000;
        let seller_amount = price.checked_sub(fee).ok_or(MarketplaceError::Overflow)?;

        // Transfer SOL from buyer to seller
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.seller.to_account_info(),
                },
            ),
            seller_amount,
        )?;

        // Transfer fee to fee recipient
        if fee > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.fee_recipient.to_account_info(),
                    },
                ),
                fee,
            )?;
        }

        // Transfer NFT from escrow to buyer
        let nft_mint_key = ctx.accounts.nft_mint.key();
        let escrow_seeds: &[&[u8]] = &[
            b"escrow",
            nft_mint_key.as_ref(),
            &[ctx.accounts.escrow.bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                &[escrow_seeds],
            ),
            1,
        )?;

        emit!(NftPurchased {
            nft_mint: listing.nft_mint,
            buyer: ctx.accounts.buyer.key(),
            seller: listing.seller,
            price,
            fee,
        });

        // Mark listing as inactive so the same PDA can be reused via init_if_needed
        let listing = &mut ctx.accounts.listing;
        listing.is_active = false;

        Ok(())
    }

    pub fn make_offer(ctx: Context<MakeOffer>, amount: u64, duration: i64) -> Result<()> {
        require!(
            !ctx.accounts.marketplace.paused,
            MarketplaceError::MarketplacePaused
        );
        require!(amount > 0, MarketplaceError::OfferAmountMustBePositive);
        require!(
            ctx.accounts.listing.is_active,
            MarketplaceError::ListingNotActive
        );
        require!(
            ctx.accounts.offerer.key() != ctx.accounts.listing.seller,
            MarketplaceError::CannotOfferOnOwnListing
        );

        let clock = Clock::get()?;

        let offer = &mut ctx.accounts.offer;
        offer.offerer = ctx.accounts.offerer.key();
        offer.nft_mint = ctx.accounts.nft_mint.key();
        offer.amount = amount;
        offer.expiration_time = clock
            .unix_timestamp
            .checked_add(duration)
            .ok_or(MarketplaceError::Overflow)?;
        offer.is_active = true;
        offer.created_at = clock.unix_timestamp;
        offer.bump = ctx.bumps.offer;

        let offer_escrow = &mut ctx.accounts.offer_escrow;
        offer_escrow.nft_mint = ctx.accounts.nft_mint.key();
        offer_escrow.offerer = ctx.accounts.offerer.key();
        offer_escrow.bump = ctx.bumps.offer_escrow;

        // Transfer SOL from offerer to offer escrow PDA
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.offerer.to_account_info(),
                    to: ctx.accounts.offer_escrow.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(OfferCreated {
            nft_mint: offer.nft_mint,
            offerer: offer.offerer,
            amount,
            expiration_time: offer.expiration_time,
        });

        Ok(())
    }

    pub fn cancel_offer(ctx: Context<CancelOffer>) -> Result<()> {
        let offer = &ctx.accounts.offer;
        require!(
            ctx.accounts.offerer.key() == offer.offerer,
            MarketplaceError::InvalidOfferer
        );
        require!(offer.is_active, MarketplaceError::OfferNotActive);

        let amount = offer.amount;

        // Return SOL from offer escrow to offerer
        let offer_escrow_info = ctx.accounts.offer_escrow.to_account_info();
        let offerer_info = ctx.accounts.offerer.to_account_info();
        **offer_escrow_info.try_borrow_mut_lamports()? -= amount;
        **offerer_info.try_borrow_mut_lamports()? += amount;

        emit!(OfferCancelled {
            nft_mint: offer.nft_mint,
            offerer: offer.offerer,
            amount,
        });

        // offer and offer_escrow closed via close constraints
        Ok(())
    }

    pub fn accept_offer(ctx: Context<AcceptOffer>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        let offer = &ctx.accounts.offer;

        require!(listing.is_active, MarketplaceError::ListingNotActive);
        require!(offer.is_active, MarketplaceError::OfferNotActive);
        require!(
            ctx.accounts.seller.key() == listing.seller,
            MarketplaceError::InvalidSeller
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < offer.expiration_time,
            MarketplaceError::OfferExpired
        );

        let amount = offer.amount;
        let fee_bps = ctx.accounts.marketplace.fee_bps as u64;
        let fee = amount
            .checked_mul(fee_bps)
            .ok_or(MarketplaceError::Overflow)?
            / 10_000;
        let seller_amount = amount.checked_sub(fee).ok_or(MarketplaceError::Overflow)?;

        // Transfer SOL from offer escrow to seller
        let offer_escrow_info = ctx.accounts.offer_escrow.to_account_info();
        let seller_info = ctx.accounts.seller.to_account_info();
        **offer_escrow_info.try_borrow_mut_lamports()? -= amount;
        **seller_info.try_borrow_mut_lamports()? += seller_amount;

        // Transfer fee to fee recipient
        if fee > 0 {
            let fee_info = ctx.accounts.fee_recipient.to_account_info();
            **fee_info.try_borrow_mut_lamports()? += fee;
        }

        // Transfer NFT from escrow to offerer (buyer)
        let nft_mint_key = ctx.accounts.nft_mint.key();
        let escrow_seeds: &[&[u8]] = &[
            b"escrow",
            nft_mint_key.as_ref(),
            &[ctx.accounts.escrow.bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.offerer_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                &[escrow_seeds],
            ),
            1,
        )?;

        emit!(OfferAccepted {
            nft_mint: listing.nft_mint,
            buyer: offer.offerer,
            seller: listing.seller,
            price: amount,
            fee,
        });

        // Mark listing as inactive
        let listing = &mut ctx.accounts.listing;
        listing.is_active = false;

        // offer and offer_escrow closed via close constraints
        Ok(())
    }

    pub fn update_price(ctx: Context<UpdatePrice>, new_price: u64) -> Result<()> {
        require!(new_price > 0, MarketplaceError::PriceMustBePositive);

        let listing = &mut ctx.accounts.listing;
        require!(listing.is_active, MarketplaceError::ListingNotActive);
        require!(
            ctx.accounts.seller.key() == listing.seller,
            MarketplaceError::InvalidSeller
        );

        let old_price = listing.price;
        listing.price = new_price;

        emit!(PriceUpdated {
            nft_mint: listing.nft_mint,
            old_price,
            new_price,
        });

        Ok(())
    }

    pub fn pause_marketplace(ctx: Context<PauseMarketplace>) -> Result<()> {
        let marketplace = &mut ctx.accounts.marketplace;
        require!(
            ctx.accounts.admin.key() == marketplace.admin,
            MarketplaceError::Unauthorized
        );
        require!(!marketplace.paused, MarketplaceError::AlreadyPaused);

        marketplace.paused = true;

        emit!(MarketplacePausedEvent { paused: true });

        Ok(())
    }

    pub fn unpause_marketplace(ctx: Context<UnpauseMarketplace>) -> Result<()> {
        let marketplace = &mut ctx.accounts.marketplace;
        require!(
            ctx.accounts.admin.key() == marketplace.admin,
            MarketplaceError::Unauthorized
        );
        require!(marketplace.paused, MarketplaceError::NotPaused);

        marketplace.paused = false;

        emit!(MarketplacePausedEvent { paused: false });

        Ok(())
    }

    pub fn update_fee(ctx: Context<UpdateFee>, new_fee_bps: u16) -> Result<()> {
        require!(new_fee_bps <= 1000, MarketplaceError::FeeTooHigh);

        let marketplace = &mut ctx.accounts.marketplace;
        require!(
            ctx.accounts.admin.key() == marketplace.admin,
            MarketplaceError::Unauthorized
        );

        let old_fee_bps = marketplace.fee_bps;
        marketplace.fee_bps = new_fee_bps;

        emit!(FeeUpdated {
            old_fee_bps,
            new_fee_bps,
        });

        Ok(())
    }

    pub fn update_fee_recipient(ctx: Context<UpdateFeeRecipient>) -> Result<()> {
        let marketplace = &mut ctx.accounts.marketplace;
        require!(
            ctx.accounts.admin.key() == marketplace.admin,
            MarketplaceError::Unauthorized
        );
        require!(
            ctx.accounts.new_fee_recipient.key() != Pubkey::default(),
            MarketplaceError::InvalidFeeRecipient
        );

        let old_recipient = marketplace.fee_recipient;
        marketplace.fee_recipient = ctx.accounts.new_fee_recipient.key();

        emit!(FeeRecipientUpdated {
            old_recipient,
            new_recipient: marketplace.fee_recipient,
        });

        Ok(())
    }

    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>, amount: u64) -> Result<()> {
        let marketplace = &mut ctx.accounts.marketplace;
        require!(
            ctx.accounts.admin.key() == marketplace.admin,
            MarketplaceError::Unauthorized
        );
        require!(amount > 0, MarketplaceError::NothingToWithdraw);

        let marketplace_info = marketplace.to_account_info();
        let admin_info = ctx.accounts.admin.to_account_info();

        let rent = Rent::get()?;
        let min_balance = rent.minimum_balance(marketplace_info.data_len());
        let available = marketplace_info
            .lamports()
            .checked_sub(min_balance)
            .ok_or(MarketplaceError::NothingToWithdraw)?;
        let withdraw_amount = amount.min(available);
        require!(withdraw_amount > 0, MarketplaceError::NothingToWithdraw);

        **marketplace_info.try_borrow_mut_lamports()? -= withdraw_amount;
        **admin_info.try_borrow_mut_lamports()? += withdraw_amount;

        Ok(())
    }
}

// ─── Account Contexts ────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + Marketplace::INIT_SPACE,
        seeds = [b"marketplace"],
        bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    /// CHECK: Fee recipient, validated by admin
    pub fee_recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ListNft<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    pub nft_mint: Account<'info, Mint>,

    /// Listing PDA — init_if_needed so a previously-purchased NFT can be re-listed
    #[account(
        init_if_needed,
        payer = seller,
        space = 8 + Listing::INIT_SPACE,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    /// Escrow authority PDA — init_if_needed so it persists across listings
    #[account(
        init_if_needed,
        payer = seller,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", nft_mint.key().as_ref()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = nft_mint,
        associated_token::authority = escrow,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"marketplace"],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump = listing.bump,
        close = authority,
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        seeds = [b"escrow", nft_mint.key().as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = escrow,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = listing.seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BuyNft<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Seller receives SOL payment — validated against listing.seller
    #[account(mut, constraint = seller.key() == listing.seller @ MarketplaceError::InvalidSeller)]
    pub seller: UncheckedAccount<'info>,

    #[account(
        seeds = [b"marketplace"],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    /// CHECK: Fee recipient — validated against marketplace.fee_recipient
    #[account(mut, constraint = fee_recipient.key() == marketplace.fee_recipient @ MarketplaceError::InvalidFeeRecipient)]
    pub fee_recipient: UncheckedAccount<'info>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump = listing.bump,
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        seeds = [b"escrow", nft_mint.key().as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = escrow,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = nft_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MakeOffer<'info> {
    #[account(mut)]
    pub offerer: Signer<'info>,

    #[account(
        seeds = [b"marketplace"],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump = listing.bump,
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        init_if_needed,
        payer = offerer,
        space = 8 + Offer::INIT_SPACE,
        seeds = [b"offer", nft_mint.key().as_ref(), offerer.key().as_ref()],
        bump,
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        init_if_needed,
        payer = offerer,
        space = 8 + OfferEscrow::INIT_SPACE,
        seeds = [b"offer_escrow", nft_mint.key().as_ref(), offerer.key().as_ref()],
        bump,
    )]
    pub offer_escrow: Account<'info, OfferEscrow>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelOffer<'info> {
    #[account(mut)]
    pub offerer: Signer<'info>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"offer", nft_mint.key().as_ref(), offerer.key().as_ref()],
        bump = offer.bump,
        close = offerer,
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        mut,
        seeds = [b"offer_escrow", nft_mint.key().as_ref(), offerer.key().as_ref()],
        bump = offer_escrow.bump,
        close = offerer,
    )]
    pub offer_escrow: Account<'info, OfferEscrow>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptOffer<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    /// CHECK: Offerer (buyer) — validated against offer.offerer
    pub offerer: UncheckedAccount<'info>,

    #[account(
        seeds = [b"marketplace"],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    /// CHECK: Fee recipient — validated against marketplace.fee_recipient
    #[account(mut, constraint = fee_recipient.key() == marketplace.fee_recipient @ MarketplaceError::InvalidFeeRecipient)]
    pub fee_recipient: UncheckedAccount<'info>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump = listing.bump,
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        seeds = [b"escrow", nft_mint.key().as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = escrow,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = nft_mint,
        associated_token::authority = offerer,
    )]
    pub offerer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"offer", nft_mint.key().as_ref(), offerer.key().as_ref()],
        bump = offer.bump,
        close = seller,
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        mut,
        seeds = [b"offer_escrow", nft_mint.key().as_ref(), offerer.key().as_ref()],
        bump = offer_escrow.bump,
        close = seller,
    )]
    pub offer_escrow: Account<'info, OfferEscrow>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    pub seller: Signer<'info>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump = listing.bump,
    )]
    pub listing: Account<'info, Listing>,
}

#[derive(Accounts)]
pub struct PauseMarketplace<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,
}

#[derive(Accounts)]
pub struct UnpauseMarketplace<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,
}

#[derive(Accounts)]
pub struct UpdateFee<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,
}

#[derive(Accounts)]
pub struct UpdateFeeRecipient<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    /// CHECK: New fee recipient
    pub new_fee_recipient: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,
}

// ─── Account Data ────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct Marketplace {
    pub admin: Pubkey,
    pub fee_recipient: Pubkey,
    pub fee_bps: u16,
    pub paused: bool,
    pub listing_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub expiration_time: i64,
    pub is_active: bool,
    pub is_auction: bool,
    pub highest_bid: u64,
    pub highest_bidder: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub offerer: Pubkey,
    pub nft_mint: Pubkey,
    pub amount: u64,
    pub expiration_time: i64,
    pub is_active: bool,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub nft_mint: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OfferEscrow {
    pub nft_mint: Pubkey,
    pub offerer: Pubkey,
    pub bump: u8,
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct MarketplaceInitialized {
    pub admin: Pubkey,
    pub fee_recipient: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct ListingCreated {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub is_auction: bool,
    pub expiration_time: i64,
}

#[event]
pub struct ListingCancelled {
    pub nft_mint: Pubkey,
    pub seller: Pubkey,
}

#[event]
pub struct NftPurchased {
    pub nft_mint: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub price: u64,
    pub fee: u64,
}

#[event]
pub struct OfferCreated {
    pub nft_mint: Pubkey,
    pub offerer: Pubkey,
    pub amount: u64,
    pub expiration_time: i64,
}

#[event]
pub struct OfferCancelled {
    pub nft_mint: Pubkey,
    pub offerer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct OfferAccepted {
    pub nft_mint: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub price: u64,
    pub fee: u64,
}

#[event]
pub struct PriceUpdated {
    pub nft_mint: Pubkey,
    pub old_price: u64,
    pub new_price: u64,
}

#[event]
pub struct MarketplacePausedEvent {
    pub paused: bool,
}

#[event]
pub struct FeeUpdated {
    pub old_fee_bps: u16,
    pub new_fee_bps: u16,
}

#[event]
pub struct FeeRecipientUpdated {
    pub old_recipient: Pubkey,
    pub new_recipient: Pubkey,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum MarketplaceError {
    #[msg("Marketplace is paused")]
    MarketplacePaused,
    #[msg("Marketplace is already paused")]
    AlreadyPaused,
    #[msg("Marketplace is not paused")]
    NotPaused,
    #[msg("Price must be greater than 0")]
    PriceMustBePositive,
    #[msg("Listing duration too short (minimum 24 hours)")]
    DurationTooShort,
    #[msg("Seller does not own the NFT")]
    SellerDoesNotOwnNft,
    #[msg("Listing is not active")]
    ListingNotActive,
    #[msg("Listing has expired")]
    ListingExpired,
    #[msg("Cannot buy your own listing")]
    CannotBuyOwnListing,
    #[msg("Use auction bidding for auction listings")]
    UseAuctionBidding,
    #[msg("Incorrect payment amount")]
    IncorrectPayment,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Fee too high (maximum 10%)")]
    FeeTooHigh,
    #[msg("Invalid fee recipient")]
    InvalidFeeRecipient,
    #[msg("Invalid seller account")]
    InvalidSeller,
    #[msg("Invalid offerer account")]
    InvalidOfferer,
    #[msg("Offer amount must be greater than 0")]
    OfferAmountMustBePositive,
    #[msg("Cannot make offer on your own listing")]
    CannotOfferOnOwnListing,
    #[msg("Offer is not active")]
    OfferNotActive,
    #[msg("Offer has expired")]
    OfferExpired,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Nothing to withdraw")]
    NothingToWithdraw,
}
