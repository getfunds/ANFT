/**
 * NFT Marketplace Utilities (Solana / Anchor)
 *
 * Real on-chain marketplace using the anft_marketplace Anchor program.
 * All PDA derivation matches the program seeds exactly.
 */

import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import IDL from '../idl/anft_marketplace.json';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
const MARKETPLACE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID || '8fpA4QsK2kwNd9JxqXd2S23FsspmFiKStmKYNBzGE8bK'
);

// ─── PDA Derivation Helpers ──────────────────────────────────────────────────

function getMarketplacePDA() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('marketplace')],
    MARKETPLACE_PROGRAM_ID
  );
}

function getListingPDA(nftMint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('listing'), new PublicKey(nftMint).toBuffer()],
    MARKETPLACE_PROGRAM_ID
  );
}

function getEscrowPDA(nftMint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), new PublicKey(nftMint).toBuffer()],
    MARKETPLACE_PROGRAM_ID
  );
}

function getOfferPDA(nftMint, offerer) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('offer'),
      new PublicKey(nftMint).toBuffer(),
      new PublicKey(offerer).toBuffer(),
    ],
    MARKETPLACE_PROGRAM_ID
  );
}

function getOfferEscrowPDA(nftMint, offerer) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('offer_escrow'),
      new PublicKey(nftMint).toBuffer(),
      new PublicKey(offerer).toBuffer(),
    ],
    MARKETPLACE_PROGRAM_ID
  );
}

// ─── Provider / Program factory ──────────────────────────────────────────────

function getConnection() {
  return new Connection(SOLANA_RPC_URL, 'confirmed');
}

function getProgram(walletAdapter) {
  const connection = getConnection();
  const provider = new AnchorProvider(connection, walletAdapter, {
    commitment: 'confirmed',
  });
  return new Program(IDL, provider);
}

function getReadonlyProgram() {
  const connection = getConnection();
  // Readonly provider — dummy wallet satisfies AnchorProvider interface for reads
  const dummyWallet = {
    publicKey: SystemProgram.programId,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };
  const provider = new AnchorProvider(connection, dummyWallet, { commitment: 'confirmed' });
  return new Program(IDL, provider);
}

// ─── Core Marketplace Functions ──────────────────────────────────────────────

/**
 * Initialize the global marketplace PDA. Must be called once before any listings.
 * The connected wallet becomes the marketplace admin.
 */
export async function initializeMarketplace(walletAdapter, walletAddress, feeBps = 250) {
  console.log('🏗️ Initializing marketplace PDA...');
  const program = getProgram(walletAdapter);
  const admin = new PublicKey(walletAddress);
  const [marketplacePDA] = getMarketplacePDA();

  const tx = await program.methods
    .initializeMarketplace(feeBps)
    .accounts({
      admin,
      marketplace: marketplacePDA,
      feeRecipient: admin,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log('✅ Marketplace initialized, tx:', tx);
  return tx;
}

/**
 * Check if marketplace PDA exists; if not, initialize it.
 */
async function ensureMarketplaceInitialized(program, walletAdapter, walletAddress) {
  const [marketplacePDA] = getMarketplacePDA();
  const connection = program.provider.connection;
  const info = await connection.getAccountInfo(marketplacePDA);
  if (!info) {
    console.log('⚠️ Marketplace not initialized — initializing now...');
    await initializeMarketplace(walletAdapter, walletAddress);
    console.log('✅ Marketplace auto-initialized');
  }
}

/**
 * Create a new NFT listing on the marketplace.
 * Transfers the NFT to the escrow PDA.
 */
export async function createMarketplaceListing(params, walletAdapter, walletAddress) {
  console.log('🏪 Creating marketplace listing on-chain:', params);

  const program = getProgram(walletAdapter);
  const connection = program.provider.connection;

  // Auto-initialize marketplace if not yet created
  await ensureMarketplaceInitialized(program, walletAdapter, walletAddress);
  const nftMint = new PublicKey(params.tokenAddress);
  const seller = new PublicKey(walletAddress);

  const [marketplacePDA] = getMarketplacePDA();
  const [listingPDA] = getListingPDA(nftMint);
  const [escrowPDA] = getEscrowPDA(nftMint);

  const sellerAta = await getAssociatedTokenAddress(nftMint, seller);
  const escrowAta = await getAssociatedTokenAddress(nftMint, escrowPDA, true);

  // Pre-flight: verify seller actually holds the NFT
  try {
    const tokenAccInfo = await connection.getTokenAccountBalance(sellerAta);
    if (!tokenAccInfo?.value || parseInt(tokenAccInfo.value.amount) < 1) {
      throw new Error('You do not hold this NFT in your wallet. It may have already been listed or transferred.');
    }
  } catch (preflight) {
    if (preflight.message.includes('do not hold')) throw preflight;
    throw new Error('Could not verify NFT ownership. Please check the mint address and try again.');
  }

  // Pre-flight: check for stale listing from a previous sale
  try {
    const existingListing = await program.account.listing.fetch(listingPDA);
    if (existingListing.isActive) {
      throw new Error('This NFT is already actively listed on the marketplace.');
    }
    // Listing exists but is inactive — re-listing (program must support init_if_needed)
    console.log('ℹ️ Re-listing NFT (previous listing found, inactive)');
  } catch (e) {
    if (e.message.includes('already actively listed')) throw e;
    // Account doesn't exist yet — first-time listing, proceed normally
  }

  const priceLamports = new BN(solToLamports(params.price));
  const duration = new BN(params.duration || 604800);
  const isAuction = params.isAuction || false;

  const tx = await program.methods
    .listNft(priceLamports, duration, isAuction)
    .accounts({
      seller,
      marketplace: marketplacePDA,
      nftMint,
      listing: listingPDA,
      escrow: escrowPDA,
      sellerTokenAccount: sellerAta,
      escrowTokenAccount: escrowAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log('✅ Listing created, tx:', tx);

  return {
    listingId: nftMint.toBase58(),
    tokenAddress: params.tokenAddress,
    tokenId: params.tokenId,
    price: params.price,
    seller: walletAddress,
    transactionId: tx,
    success: true,
    message: 'Listing created on Solana marketplace',
  };
}

/**
 * Purchase an NFT from an active listing.
 * Sends SOL to seller (minus fee) and receives NFT from escrow.
 */
export async function purchaseNFT(nftMintAddress, walletAdapter, walletAddress) {
  console.log('💰 Purchasing NFT:', nftMintAddress);

  const program = getProgram(walletAdapter);
  const nftMint = new PublicKey(nftMintAddress);
  const buyer = new PublicKey(walletAddress);

  const [marketplacePDA] = getMarketplacePDA();
  const [listingPDA] = getListingPDA(nftMint);
  const [escrowPDA] = getEscrowPDA(nftMint);

  // Fetch listing to get seller and marketplace to get fee recipient
  const listing = await program.account.listing.fetch(listingPDA);
  const marketplace = await program.account.marketplace.fetch(marketplacePDA);

  const escrowAta = await getAssociatedTokenAddress(nftMint, escrowPDA, true);
  const buyerAta = await getAssociatedTokenAddress(nftMint, buyer);

  const tx = await program.methods
    .buyNft()
    .accounts({
      buyer,
      seller: listing.seller,
      marketplace: marketplacePDA,
      feeRecipient: marketplace.feeRecipient,
      nftMint,
      listing: listingPDA,
      escrow: escrowPDA,
      escrowTokenAccount: escrowAta,
      buyerTokenAccount: buyerAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log('✅ NFT purchased, tx:', tx);

  return {
    transactionId: tx,
    listingId: nftMintAddress,
    buyer: walletAddress,
    success: true,
    message: 'NFT purchased on Solana marketplace',
  };
}

/**
 * Cancel an active listing. Returns NFT from escrow to seller.
 */
export async function cancelListing(nftMintAddress, walletAdapter, walletAddress) {
  console.log('🚫 Cancelling listing:', nftMintAddress);

  const program = getProgram(walletAdapter);
  const nftMint = new PublicKey(nftMintAddress);
  const authority = new PublicKey(walletAddress);

  const [marketplacePDA] = getMarketplacePDA();
  const [listingPDA] = getListingPDA(nftMint);
  const [escrowPDA] = getEscrowPDA(nftMint);

  const listing = await program.account.listing.fetch(listingPDA);

  const escrowAta = await getAssociatedTokenAddress(nftMint, escrowPDA, true);
  const sellerAta = await getAssociatedTokenAddress(nftMint, listing.seller);

  const tx = await program.methods
    .cancelListing()
    .accounts({
      authority,
      marketplace: marketplacePDA,
      nftMint,
      listing: listingPDA,
      escrow: escrowPDA,
      escrowTokenAccount: escrowAta,
      sellerTokenAccount: sellerAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log('✅ Listing cancelled, tx:', tx);

  return { success: true, listingId: nftMintAddress, transactionId: tx };
}

/**
 * Get a specific listing by NFT mint address.
 */
export async function getListing(nftMintAddress) {
  try {
    const program = getReadonlyProgram();
    const nftMint = new PublicKey(nftMintAddress);
    const [listingPDA] = getListingPDA(nftMint);

    const listing = await program.account.listing.fetch(listingPDA);

    return {
      nftMint: listing.nftMint.toBase58(),
      seller: listing.seller.toBase58(),
      price: listing.price.toString(),
      priceInSOL: lamportsToSol(listing.price.toString()),
      expirationTime: new Date(listing.expirationTime.toNumber() * 1000).toISOString(),
      isActive: listing.isActive,
      isAuction: listing.isAuction,
      highestBid: listing.highestBid.toString(),
      highestBidder: listing.highestBidder.toBase58(),
      createdAt: new Date(listing.createdAt.toNumber() * 1000).toISOString(),
    };
  } catch (error) {
    console.warn('Listing not found:', nftMintAddress, error.message);
    return null;
  }
}

/**
 * Get all active listings from on-chain data.
 * Uses getProgramAccounts with a filter on isActive = true.
 */
export async function getActiveListings() {
  try {
    const program = getReadonlyProgram();

    // Fetch all Listing accounts
    const allListings = await program.account.listing.all([
      // Filter for isActive = true (byte offset: 8 discriminator + 32 seller + 32 nftMint + 8 price + 8 expirationTime = 88)
      {
        memcmp: {
          offset: 88,
          bytes: '2', // base58 encoding of byte [0x01] (true)
        },
      },
    ]);

    return allListings
      .map((item) => {
        const listing = item.account;
        return {
          id: listing.nftMint.toBase58(),
          listingId: listing.nftMint.toBase58(),
          tokenAddress: listing.nftMint.toBase58(),
          tokenId: listing.nftMint.toBase58(),
          seller: listing.seller.toBase58(),
          price: listing.price.toString(),
          priceInSOL: lamportsToSol(listing.price.toString()),
          expirationTime: new Date(listing.expirationTime.toNumber() * 1000).toISOString(),
          isActive: listing.isActive,
          isAuction: listing.isAuction,
          highestBid: listing.highestBid.toString(),
          highestBidInSOL: lamportsToSol(listing.highestBid.toString()),
          highestBidder: listing.highestBidder.toBase58(),
          createdAt: new Date(listing.createdAt.toNumber() * 1000).toISOString(),
        };
      })
      .filter((l) => l.isActive);
  } catch (error) {
    console.error('Error fetching active listings:', error);
    return [];
  }
}

/**
 * Get active listings count.
 */
export async function getActiveListingsCount() {
  const listings = await getActiveListings();
  return listings.length;
}

/**
 * Get marketplace listings with pagination (for API compatibility).
 */
export async function getMarketplaceListings(offset = 0, limit = 20) {
  const all = await getActiveListings();
  return all.slice(offset, offset + limit);
}

/**
 * Make an offer on a listed NFT.
 * Holds SOL in an offer escrow PDA.
 */
export async function makeOffer(params, walletAdapter, walletAddress) {
  console.log('💡 Making offer:', params);

  const program = getProgram(walletAdapter);
  const nftMint = new PublicKey(params.listingId || params.nftMint);
  const offerer = new PublicKey(walletAddress);

  const [marketplacePDA] = getMarketplacePDA();
  const [listingPDA] = getListingPDA(nftMint);
  const [offerPDA] = getOfferPDA(nftMint, offerer);
  const [offerEscrowPDA] = getOfferEscrowPDA(nftMint, offerer);

  const amountLamports = new BN(solToLamports(params.amount));
  const duration = new BN(params.duration || 86400);

  const tx = await program.methods
    .makeOffer(amountLamports, duration)
    .accounts({
      offerer,
      marketplace: marketplacePDA,
      nftMint,
      listing: listingPDA,
      offer: offerPDA,
      offerEscrow: offerEscrowPDA,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log('✅ Offer created, tx:', tx);

  return {
    success: true,
    offerId: offerPDA.toBase58(),
    transactionId: tx,
    message: 'Offer placed on Solana marketplace',
  };
}

/**
 * Cancel an offer. Returns SOL from escrow to offerer.
 */
export async function cancelOffer(nftMintAddress, walletAdapter, walletAddress) {
  console.log('🚫 Cancelling offer:', nftMintAddress);

  const program = getProgram(walletAdapter);
  const nftMint = new PublicKey(nftMintAddress);
  const offerer = new PublicKey(walletAddress);

  const [offerPDA] = getOfferPDA(nftMint, offerer);
  const [offerEscrowPDA] = getOfferEscrowPDA(nftMint, offerer);

  const tx = await program.methods
    .cancelOffer()
    .accounts({
      offerer,
      nftMint,
      offer: offerPDA,
      offerEscrow: offerEscrowPDA,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log('✅ Offer cancelled, tx:', tx);

  return { success: true, transactionId: tx };
}

/**
 * Accept an offer on your listing.
 */
export async function acceptOffer(nftMintAddress, offererAddress, walletAdapter, walletAddress) {
  console.log('✅ Accepting offer:', { nftMintAddress, offererAddress });

  const program = getProgram(walletAdapter);
  const nftMint = new PublicKey(nftMintAddress);
  const seller = new PublicKey(walletAddress);
  const offerer = new PublicKey(offererAddress);

  const [marketplacePDA] = getMarketplacePDA();
  const [listingPDA] = getListingPDA(nftMint);
  const [escrowPDA] = getEscrowPDA(nftMint);
  const [offerPDA] = getOfferPDA(nftMint, offerer);
  const [offerEscrowPDA] = getOfferEscrowPDA(nftMint, offerer);

  const marketplace = await program.account.marketplace.fetch(marketplacePDA);

  const escrowAta = await getAssociatedTokenAddress(nftMint, escrowPDA, true);
  const offererAta = await getAssociatedTokenAddress(nftMint, offerer);

  const tx = await program.methods
    .acceptOffer()
    .accounts({
      seller,
      offerer,
      marketplace: marketplacePDA,
      feeRecipient: marketplace.feeRecipient,
      nftMint,
      listing: listingPDA,
      escrow: escrowPDA,
      escrowTokenAccount: escrowAta,
      offererTokenAccount: offererAta,
      offer: offerPDA,
      offerEscrow: offerEscrowPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log('✅ Offer accepted, tx:', tx);

  return {
    success: true,
    transactionId: tx,
    message: 'Offer accepted — NFT transferred to buyer',
  };
}

/**
 * Place a bid on an auction listing (alias for makeOffer on auctions).
 */
export async function placeBid(nftMintAddress, bidAmount, walletAdapter, walletAddress) {
  return makeOffer(
    { listingId: nftMintAddress, amount: bidAmount, duration: 86400 },
    walletAdapter,
    walletAddress
  );
}

/**
 * Check if an NFT is currently listed.
 */
export async function checkListingStatus(nftMintAddress) {
  try {
    const listing = await getListing(nftMintAddress);
    if (listing && listing.isActive) {
      return { isListed: true, listing };
    }
    return { isListed: false };
  } catch {
    return { isListed: false };
  }
}

// ─── Utility functions ───────────────────────────────────────────────────────

/**
 * Get Solana explorer URL for a transaction or address.
 */
export function getExplorerUrl(txOrAddress, type = 'tx') {
  const clusterParam = CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`;
  return `https://explorer.solana.com/${type}/${txOrAddress}${clusterParam}`;
}

/**
 * Convert SOL to lamports.
 */
export function solToLamports(sol) {
  return Math.round(parseFloat(sol) * 1e9);
}

/**
 * Convert lamports to SOL.
 */
export function lamportsToSol(lamports) {
  return (parseInt(lamports) / 1e9).toFixed(4);
}

export default {
  createMarketplaceListing,
  purchaseNFT,
  cancelListing,
  getListing,
  getActiveListings,
  getActiveListingsCount,
  getMarketplaceListings,
  placeBid,
  makeOffer,
  cancelOffer,
  acceptOffer,
  checkListingStatus,
  getExplorerUrl,
  solToLamports,
  lamportsToSol,
};
