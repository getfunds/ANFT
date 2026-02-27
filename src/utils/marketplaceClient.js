
import {
  getMarketplaceListings as _getListings,
  getListing,
  createMarketplaceListing as _createListing,
  purchaseNFT,
  cancelListing,
  placeBid,
  makeOffer,
  cancelOffer,
  acceptOffer,
  checkListingStatus,
  getExplorerUrl,
  lamportsToSol,
} from './marketplace';


export async function getMarketplaceListings(offset = 0, limit = 20) {
  try {
    console.log('📋 Fetching marketplace listings from on-chain...', { offset, limit });
    const listings = await _getListings(offset, limit);
    console.log('✅ Fetched marketplace listings:', listings.length);
    return listings;
  } catch (error) {
    console.error('❌ Error fetching marketplace listings:', error);
    return [];
  }
}

/**
 * Create a new NFT listing (on-chain transaction).
 */
export async function createMarketplaceListing(params, walletAdapter, accountId) {
  try {
    console.log('🏪 Creating marketplace listing on-chain...', params);
    const result = await _createListing(params, walletAdapter, accountId);
    console.log('✅ Listing created successfully:', result);
    return result;
  } catch (error) {
    console.error('❌ Error creating marketplace listing:', error);
    throw error;
  }
}

/**
 * Purchase an NFT from a listing (on-chain transaction).
 */
export async function purchaseNFTFromMarketplace(nftMintAddress, price, walletAdapter, accountId) {
  try {
    console.log('💰 Purchasing NFT from marketplace...', { nftMintAddress, price });
    const result = await purchaseNFT(nftMintAddress, walletAdapter, accountId);
    console.log('✅ NFT purchased successfully:', result);
    return result;
  } catch (error) {
    console.error('❌ Error purchasing NFT:', error);
    throw error;
  }
}

/**
 * Place a bid on an auction (on-chain transaction).
 */
export async function placeBidOnAuction(nftMintAddress, bidAmount, walletAdapter, accountId) {
  try {
    console.log('🎯 Placing bid on auction...', { nftMintAddress, bidAmount });
    const result = await placeBid(nftMintAddress, bidAmount, walletAdapter, accountId);
    console.log('✅ Bid placed successfully:', result);
    return result;
  } catch (error) {
    console.error('❌ Error placing bid:', error);
    throw error;
  }
}

/**
 * Make an offer on a listing (on-chain transaction).
 */
export async function makeOfferOnListing(nftMintAddress, offerAmount, duration, walletAdapter, accountId) {
  try {
    console.log('💡 Making offer on listing...', { nftMintAddress, offerAmount, duration });
    const result = await makeOffer(
      { listingId: nftMintAddress, amount: offerAmount, duration },
      walletAdapter,
      accountId
    );
    console.log('✅ Offer made successfully:', result);
    return result;
  } catch (error) {
    console.error('❌ Error making offer:', error);
    throw error;
  }
}

/**
 * Get detailed information about a specific listing (on-chain read).
 */
export async function getListingDetails(nftMintAddress) {
  try {
    console.log('🔍 Fetching listing details from on-chain...', { nftMintAddress });
    const listing = await getListing(nftMintAddress);
    console.log('✅ Fetched listing details:', listing);
    return listing;
  } catch (error) {
    console.error('❌ Error fetching listing details:', error);
    throw error;
  }
}

export {
  cancelListing,
  cancelOffer,
  acceptOffer,
  checkListingStatus,
  getExplorerUrl,
  lamportsToSol,
};

export default {
  getMarketplaceListings,
  createMarketplaceListing,
  purchaseNFTFromMarketplace,
  placeBidOnAuction,
  makeOfferOnListing,
  getListingDetails,
  cancelListing,
  cancelOffer,
  acceptOffer,
  checkListingStatus,
  getExplorerUrl,
  lamportsToSol,
};
