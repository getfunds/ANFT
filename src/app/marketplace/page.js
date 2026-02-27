'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../../hooks/useWalletAdapter';
import { 
  getMarketplaceListings
} from '../../utils/marketplaceClient';
import { getNFTMetadata } from '../../utils/nftUtils';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

const MarketplacePage = () => {
  const router = useRouter();
  const { isConnected, accountId, walletAdapter } = useWallet();
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters and sorting
  const [priceFilter, setPriceFilter] = useState('all'); // all, low, medium, high
  const [typeFilter, setTypeFilter] = useState('all'); // all, fixed, auction
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, price-low, price-high
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [selectedListing, setSelectedListing] = useState(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailListing, setDetailListing] = useState(null);
  
  // Transaction states
  const [isTransacting, setIsTransacting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerDuration, setOfferDuration] = useState('86400'); // 24 hours default
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  const applyFiltersAndSort = useCallback(() => {
    let filtered = [...listings];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(listing =>
        listing.metadata.name.toLowerCase().includes(query) ||
        listing.metadata.description.toLowerCase().includes(query) ||
        listing.seller.toLowerCase().includes(query)
      );
    }

    if (priceFilter !== 'all') {
      filtered = filtered.filter(listing => {
        const price = parseFloat(listing.priceInSOL || listing.price);
        switch (priceFilter) {
          case 'low': return price <= 10;
          case 'medium': return price > 10 && price <= 100;
          case 'high': return price > 100;
          default: return true;
        }
      });
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(listing =>
        listing.metadata.name.toLowerCase().includes(typeFilter.toLowerCase()) ||
        listing.metadata.description.toLowerCase().includes(typeFilter.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return parseFloat(a.priceInSOL || a.price) - parseFloat(b.priceInSOL || b.price);
        case 'price-high':
          return parseFloat(b.priceInSOL || b.price) - parseFloat(a.priceInSOL || a.price);
        case 'name':
          return a.metadata.name.localeCompare(b.metadata.name);
        case 'newest':
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });

    setFilteredListings(filtered);
    setCurrentPage(1);
  }, [listings, priceFilter, typeFilter, sortBy, searchQuery]);

  useEffect(() => {
    loadMarketplaceListings();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  const loadMarketplaceListings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const listings = await getMarketplaceListings(0, 100);

      const processedListings = await Promise.all(
        listings.map(async (listing) => {
          try {
            let metadata = listing.metadata;

            if (!metadata) {
              try {
                const { Connection, PublicKey } = await import('@solana/web3.js');
                const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
                const mintPubkey = new PublicKey(listing.tokenAddress);
                const [metadataPDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
                  TOKEN_METADATA_PROGRAM_ID
                );
                const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
                const accountInfo = await connection.getAccountInfo(metadataPDA);
                if (accountInfo && accountInfo.data) {
                  const data = accountInfo.data;
                  let offset = 1 + 32 + 32;
                  const nameLen = data.readUInt32LE(offset); offset += 4;
                  offset += nameLen;
                  const symbolLen = data.readUInt32LE(offset); offset += 4;
                  offset += symbolLen;
                  const uriLen = data.readUInt32LE(offset); offset += 4;
                  const uri = data.slice(offset, offset + uriLen).toString('utf-8').replace(/\0/g, '').trim();
                  if (uri && (uri.startsWith('http') || uri.startsWith('ipfs'))) {
                    metadata = await getNFTMetadata(uri);
                  }
                }
              } catch { /* metadata fetch failed, use fallback */ }
            }

            if (!metadata) {
              metadata = {
                name: `NFT #${listing.tokenId}`,
                description: 'Authentic artwork minted on Solana',
                image: '/placeholder-nft.png',
                attributes: [
                  { trait_type: 'Collection', value: 'ANFT' },
                  { trait_type: 'Token ID', value: listing.tokenId },
                  { trait_type: 'Network', value: 'Solana' }
                ]
              };
            }

            if (metadata.image && metadata.image.startsWith('ipfs://')) {
              metadata.image = `https://ipfs.filebase.io/ipfs/${metadata.image.replace('ipfs://', '')}`;
            }

            return { ...listing, metadata };
          } catch {
            return {
              ...listing,
              metadata: {
                name: `NFT #${listing.tokenId}`,
                description: 'Authentic artwork — metadata temporarily unavailable',
                image: '/placeholder-nft.png',
                attributes: [{ trait_type: 'Collection', value: 'ANFT' }]
              }
            };
          }
        })
      );

      setListings(processedListings);
    } catch {
      setError('Failed to load marketplace listings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchaseNFT = async (listing) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    try {
      setIsTransacting(true);
      const { purchaseNFT: purchaseNFTFromMarketplace } = await import('../../utils/marketplace');
      const result = await purchaseNFTFromMarketplace(listing.listingId, walletAdapter, accountId);
      setShowBuyModal(false);
      if (result.success) {
        const successUrl = new URL('/purchase-success', window.location.origin);
        successUrl.searchParams.set('name', listing.metadata.name || 'NFT');
        successUrl.searchParams.set('tokenId', listing.tokenAddress);
        successUrl.searchParams.set('serialNumber', listing.tokenId);
        successUrl.searchParams.set('transactionId', result.transactionId || '');
        successUrl.searchParams.set('price', listing.priceInSOL);
        if (listing.metadata.image) successUrl.searchParams.set('image', listing.metadata.image);
        router.push(successUrl.toString());
      } else {
        alert(`Purchase failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Purchase failed: ${error.message}`);
    } finally {
      setIsTransacting(false);
    }
  };

  const handlePlaceBid = async (listing) => {
    if (!isConnected) { alert('Please connect your wallet first'); return; }
    if (!bidAmount || parseFloat(bidAmount) <= 0) { alert('Please enter a valid bid amount'); return; }
    try {
      setIsTransacting(true);
      const { placeBid: placeBidOnAuction } = await import('../../utils/marketplace');
      await placeBidOnAuction(listing.listingId, bidAmount, walletAdapter, accountId);
      alert(`Successfully placed bid of ${bidAmount} SOL on ${listing.metadata.name}!`);
      setShowBidModal(false);
      setBidAmount('');
      await loadMarketplaceListings();
    } catch (error) {
      alert(`Bid failed: ${error.message}`);
    } finally {
      setIsTransacting(false);
    }
  };

  const handleMakeOffer = async (listing) => {
    if (!isConnected) { alert('Please connect your wallet first'); return; }
    if (!offerAmount || parseFloat(offerAmount) <= 0) { alert('Please enter a valid offer amount'); return; }
    try {
      setIsTransacting(true);
      const { makeOffer: makeOfferOnListing } = await import('../../utils/marketplace');
      await makeOfferOnListing(
        { listingId: listing.listingId, amount: offerAmount, duration: parseInt(offerDuration) },
        walletAdapter, accountId
      );
      alert(`Successfully made offer of ${offerAmount} SOL on ${listing.metadata.name}!`);
      setShowOfferModal(false);
      setOfferAmount('');
      await loadMarketplaceListings();
    } catch (error) {
      alert(`Offer failed: ${error.message}`);
    } finally {
      setIsTransacting(false);
    }
  };

  const handleCancelListing = async (listing) => {
    if (!isConnected) return;
    try {
      setIsCancelling(true);
      const { cancelListing: cancelMarketplaceListing } = await import('../../utils/marketplace');
      await cancelMarketplaceListing(listing.tokenAddress || listing.listingId, walletAdapter, accountId);
      setShowCancelModal(false);
      setSelectedListing(null);
      setListings(prev => prev.filter(l => l.listingId !== listing.listingId));
    } catch (error) {
      alert(`Failed to cancel listing: ${error.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const openBuyModal = (listing) => {
    setSelectedListing(listing);
    setShowBuyModal(true);
  };

  const openBidModal = (listing) => {
    setSelectedListing(listing);
    setShowBidModal(true);
    setBidAmount('');
  };

  const openOfferModal = (listing) => {
    setSelectedListing(listing);
    setShowOfferModal(true);
    setOfferAmount('');
  };

  const openCancelModal = (listing) => {
    setSelectedListing(listing);
    setShowCancelModal(true);
  };

  const openDetailModal = (listing) => {
    setDetailListing(listing);
    setShowDetailModal(true);
  };

  const formatAccountId = (addr) => {
    if (!addr) return '—';
    return addr.length > 12 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;
  };

  const formatTimeRemaining = (expirationTime) => {
    const now = new Date().getTime();
    const expiry = new Date(expirationTime).getTime();
    const timeLeft = expiry - now;
    if (timeLeft <= 0) return 'Expired';
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const InlineCopy = ({ text }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch { /* fallback */ }
    };
    return (
      <button onClick={handleCopy} className={styles.detailCopyBtn} title={copied ? 'Copied!' : 'Copy'}>
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        )}
      </button>
    );
  };

  const totalPages = Math.ceil(filteredListings.length / itemsPerPage);
  const paginatedListings = filteredListings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p className={styles.loadingText}>Loading marketplace...</p>
          <p className={styles.loadingSubtext}>Discovering amazing NFTs</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>
            <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className={styles.errorTitle}>Failed to Load Marketplace</h2>
          <p className={styles.errorMessage}>{error}</p>
          <button 
            onClick={() => loadMarketplaceListings()} 
            className={styles.retryButton}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          NFT <span className={styles.gradientText}>Marketplace</span>
        </h1>
        <p className={styles.subtitle}>
          Discover, buy, and sell authentic NFTs on Solana
        </p>
      </div>

      {/* Filters and Search */}
      <div className={styles.filtersCard}>
        <div className={styles.filtersContainer}>
          {/* Search */}
          <div className={styles.searchContainer}>
            <svg className={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search NFTs, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Filter Buttons */}
          <div className={styles.filterSection}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Price:</label>
              <select 
                value={priceFilter} 
                onChange={(e) => setPriceFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Prices</option>
                <option value="low">Under 10 SOL</option>
                <option value="medium">10-100 SOL</option>
                <option value="high">Over 100 SOL</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Type:</label>
              <select 
                value={typeFilter} 
                onChange={(e) => setTypeFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Types</option>
                <option value="fixed">Fixed Price</option>
                <option value="auction">Auction</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Sort:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className={styles.resultsInfo}>
          <span className={styles.resultsCount}>
            {filteredListings.length} NFT{filteredListings.length !== 1 ? 's' : ''} found
          </span>
          {!isConnected && (
            <div className={styles.connectPrompt}>
              <svg className={styles.walletIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Connect wallet to buy NFTs
            </div>
          )}
        </div>
      </div>

      {/* NFT Grid */}
      {paginatedListings.length === 0 ? (
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className={styles.emptyTitle}>No NFTs Found</h3>
          <p className={styles.emptyDescription}>
            {searchQuery || priceFilter !== 'all' || typeFilter !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'No NFTs are currently listed in the marketplace'
            }
          </p>
          <div className={styles.emptyActions}>
            <Link href="/create" className={styles.createButton}>
              Create Your First NFT
            </Link>
            <Link href="/profile" className={styles.sellButton}>
              Sell Your NFTs
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.nftGrid}>
          {paginatedListings.map((listing) => (
            <div key={listing.listingId} className={styles.nftCard}>
              {/* NFT Image */}
              <div className={styles.nftImageContainer}>
                <Image
                  src={listing.metadata.image}
                  alt={listing.metadata.name}
                  fill
                  className={styles.nftImage}
                  onError={(e) => {
                    e.target.src = '/placeholder-nft.png';
                  }}
                />
                
                {/* Status Badges */}
                <div className={styles.statusBadges}>
                  {listing.isAuction ? (
                    <span className={styles.auctionBadge}>
                      🎯 Auction
                    </span>
                  ) : (
                    <span className={styles.fixedBadge}>
                      💰 Fixed Price
                    </span>
                  )}
                </div>

                {/* Time Remaining */}
                <div className={styles.timeRemaining}>
                  ⏰ {formatTimeRemaining(listing.expirationTime)}
                </div>
              </div>

              {/* NFT Info */}
              <div className={styles.nftContent}>
                <h3 className={styles.nftTitle}>{listing.metadata.name}</h3>
                <p className={styles.nftDescription}>{listing.metadata.description}</p>

                <div className={styles.nftMeta}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Seller</span>
                    <span className={styles.metaValue}>{formatAccountId(listing.seller)}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Mint</span>
                    <span className={styles.metaValue}>{formatAccountId(listing.tokenAddress)}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Expires</span>
                    <span className={styles.metaValue}>{formatTimeRemaining(listing.expirationTime)}</span>
                  </div>
                </div>

                {listing.metadata.attributes && listing.metadata.attributes.filter(a => a.trait_type !== 'AI Model' && a.trait_type !== 'ai_model').length > 0 && (
                  <div className={styles.attributesSection}>
                    <div className={styles.attributesContainer}>
                      {listing.metadata.attributes
                        .filter(a => a.trait_type !== 'AI Model' && a.trait_type !== 'ai_model')
                        .slice(0, 3)
                        .map((attr, index) => (
                          <span key={`${listing.listingId}-attr-${index}`} className={styles.attributeBadge}>
                            {attr.trait_type}: {attr.value}
                          </span>
                        ))}
                      {listing.metadata.attributes.filter(a => a.trait_type !== 'AI Model' && a.trait_type !== 'ai_model').length > 3 && (
                        <span className={styles.attributeBadgeMore}>
                          +{listing.metadata.attributes.filter(a => a.trait_type !== 'AI Model' && a.trait_type !== 'ai_model').length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className={styles.priceSection}>
                  <div className={styles.priceInfo}>
                    <span className={styles.priceLabel}>Price</span>
                    <span className={styles.price}>{listing.priceInSOL} SOL</span>
                  </div>

                  <div className={styles.nftActions}>
                    <button onClick={() => openDetailModal(listing)} className={styles.detailsButton}>
                      Details
                    </button>
                    {isConnected && listing.seller !== accountId && (
                      <button onClick={() => openBuyModal(listing)} className={styles.buyButton}>
                        <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0L15 13M7 13h8m-8 0V9a2 2 0 012-2h6a2 2 0 012 2v4" />
                        </svg>
                        Buy Now
                      </button>
                    )}
                    {!isConnected && (
                      <span className={styles.connectRequired}>Connect wallet</span>
                    )}
                    {isConnected && listing.seller === accountId && (
                      <button onClick={() => openCancelModal(listing)} className={styles.cancelListingButton}>
                        <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={styles.paginationButton}
          >
            ← Previous
          </button>
          
          <span className={styles.paginationInfo}>
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={styles.paginationButton}
          >
            Next →
          </button>
        </div>
      )}

      {/* NFT Detail Modal */}
      {showDetailModal && detailListing && (
        <div className={styles.detailOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowDetailModal(false); }}>
          <div className={styles.detailPanel}>
            <button className={styles.detailCloseBtn} onClick={() => setShowDetailModal(false)}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className={styles.detailLayout}>
              <div className={styles.detailImageCol}>
                <div className={styles.detailImageWrap}>
                  <Image
                    src={detailListing.metadata.image}
                    alt={detailListing.metadata.name}
                    fill
                    className={styles.detailImage}
                  />
                  <div className={styles.detailImageBadge}>
                    {detailListing.isAuction ? '🎯 Auction' : '💰 Fixed Price'}
                  </div>
                </div>
              </div>

              <div className={styles.detailInfoCol}>
                <h2 className={styles.detailName}>{detailListing.metadata.name}</h2>
                {detailListing.metadata.description && (
                  <p className={styles.detailDesc}>{detailListing.metadata.description}</p>
                )}

                <div className={styles.detailPriceBanner}>
                  <div>
                    <span className={styles.detailPriceLabel}>Current Price</span>
                    <span className={styles.detailPrice}>{detailListing.priceInSOL} SOL</span>
                  </div>
                  <div className={styles.detailExpiry}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatTimeRemaining(detailListing.expirationTime)}
                  </div>
                </div>

                <div className={styles.detailInfoList}>
                  <div className={styles.detailInfoRow}>
                    <span className={styles.detailInfoLabel}>Mint Address</span>
                    <div className={styles.detailInfoValueRow}>
                      <span className={styles.detailInfoValue}>{detailListing.tokenAddress}</span>
                      <InlineCopy text={detailListing.tokenAddress} />
                    </div>
                  </div>
                  <div className={styles.detailInfoRow}>
                    <span className={styles.detailInfoLabel}>Seller</span>
                    <div className={styles.detailInfoValueRow}>
                      <span className={styles.detailInfoValue}>{detailListing.seller}</span>
                      <InlineCopy text={detailListing.seller} />
                    </div>
                  </div>
                  {detailListing.metadata?.creator_did && (
                    <div className={styles.detailInfoRow}>
                      <span className={styles.detailInfoLabel}>Creator DID</span>
                      <div className={styles.detailInfoValueRow}>
                        <span className={styles.detailInfoValue}>{detailListing.metadata.creator_did}</span>
                        <InlineCopy text={detailListing.metadata.creator_did} />
                      </div>
                    </div>
                  )}
                  {detailListing.metadata?.creator && (
                    <div className={styles.detailInfoRow}>
                      <span className={styles.detailInfoLabel}>Creator</span>
                      <div className={styles.detailInfoValueRow}>
                        <span className={styles.detailInfoValue}>{detailListing.metadata.creator}</span>
                        <InlineCopy text={detailListing.metadata.creator} />
                      </div>
                    </div>
                  )}
                  {detailListing.metadata?.content_hash && (
                    <div className={styles.detailInfoRow}>
                      <span className={styles.detailInfoLabel}>Content Hash</span>
                      <div className={styles.detailInfoValueRow}>
                        <span className={styles.detailInfoValue}>{detailListing.metadata.content_hash}</span>
                        <InlineCopy text={detailListing.metadata.content_hash} />
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.detailActions}>
                  {isConnected && detailListing.seller !== accountId && (
                    <button
                      onClick={() => { setShowDetailModal(false); openBuyModal(detailListing); }}
                      className={styles.detailBuyBtn}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0L15 13M7 13h8m-8 0V9a2 2 0 012-2h6a2 2 0 012 2v4" />
                      </svg>
                      Buy for {detailListing.priceInSOL} SOL
                    </button>
                  )}
                  {isConnected && detailListing.seller === accountId && (
                    <button
                      onClick={() => { setShowDetailModal(false); openCancelModal(detailListing); }}
                      className={styles.detailCancelBtn}
                    >
                      Cancel Listing
                    </button>
                  )}
                  {!isConnected && (
                    <p className={styles.detailConnectNote}>Connect your wallet to purchase this NFT</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buy Modal */}
      {showBuyModal && selectedListing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Purchase NFT</h2>
              <button
                onClick={() => setShowBuyModal(false)}
                className={styles.closeButton}
              >
                <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.purchasePreview}>
                <Image
                  src={selectedListing.metadata.image}
                  alt={selectedListing.metadata.name}
                  width={200}
                  height={200}
                  className={styles.modalNftImage}
                />
                <div className={styles.purchaseDetails}>
                  <h3 className={styles.modalNftTitle}>{selectedListing.metadata.name}</h3>
                  <p className={styles.modalNftDescription}>{selectedListing.metadata.description}</p>
                  <div className={styles.modalPriceInfo}>
                    <span className={styles.modalPriceLabel}>Price:</span>
                    <span className={styles.modalPrice}>{selectedListing.priceInSOL} SOL</span>
                  </div>
                </div>
              </div>
              
              <div className={styles.modalActions}>
                <button
                  onClick={() => setShowBuyModal(false)}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePurchaseNFT(selectedListing)}
                  disabled={isTransacting}
                  className={styles.confirmButton}
                >
                  {isTransacting ? (
                    <>
                      <div className={styles.loadingSpinner}></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0L15 13M7 13h8m-8 0V9a2 2 0 012-2h6a2 2 0 012 2v4" />
                      </svg>
                      Buy for {selectedListing.priceInSOL} SOL
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bid Modal */}
      {showBidModal && selectedListing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Place Bid</h2>
              <button
                onClick={() => setShowBidModal(false)}
                className={styles.closeButton}
              >
                <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.bidInfo}>
                <h3 className={styles.modalNftTitle}>{selectedListing.metadata.name}</h3>
                <div className={styles.currentBidInfo}>
                  <span>Current Highest Bid: {selectedListing.highestBidInSOL || selectedListing.priceInSOL} SOL</span>
                </div>
              </div>
              
              <div className={styles.bidInput}>
                <label className={styles.inputLabel}>Your Bid (SOL):</label>
                <input
                  type="number"
                  step="0.01"
                  min={parseFloat(selectedListing.highestBidInSOL || selectedListing.priceInSOL) + 0.01}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Enter bid amount"
                  className={styles.numberInput}
                />
              </div>
              
              <div className={styles.modalActions}>
                <button
                  onClick={() => setShowBidModal(false)}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePlaceBid(selectedListing)}
                  disabled={isTransacting || !bidAmount}
                  className={styles.confirmButton}
                >
                  {isTransacting ? (
                    <>
                      <div className={styles.loadingSpinner}></div>
                      Placing Bid...
                    </>
                  ) : (
                    <>
                      <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Place Bid
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {showOfferModal && selectedListing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Make Offer</h2>
              <button
                onClick={() => setShowOfferModal(false)}
                className={styles.closeButton}
              >
                <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.offerInfo}>
                <h3 className={styles.modalNftTitle}>{selectedListing.metadata.name}</h3>
                <div className={styles.listingPriceInfo}>
                  <span>Listed Price: {selectedListing.priceInSOL} SOL</span>
                </div>
              </div>
              
              <div className={styles.offerInputs}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Offer Amount (SOL):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    placeholder="Enter offer amount"
                    className={styles.numberInput}
                  />
                </div>
                
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Offer Duration:</label>
                  <select
                    value={offerDuration}
                    onChange={(e) => setOfferDuration(e.target.value)}
                    className={styles.selectInput}
                  >
                    <option value="3600">1 Hour</option>
                    <option value="86400">24 Hours</option>
                    <option value="259200">3 Days</option>
                    <option value="604800">7 Days</option>
                  </select>
                </div>
              </div>
              
              <div className={styles.offerNote}>
                <p>Your offer amount will be held in escrow until the offer expires or is accepted.</p>
              </div>
              
              <div className={styles.modalActions}>
                <button
                  onClick={() => setShowOfferModal(false)}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleMakeOffer(selectedListing)}
                  disabled={isTransacting || !offerAmount}
                  className={styles.confirmButton}
                >
                  {isTransacting ? (
                    <>
                      <div className={styles.loadingSpinner}></div>
                      Making Offer...
                    </>
                  ) : (
                    <>
                      <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      Make Offer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Listing Confirmation Modal */}
      {showCancelModal && selectedListing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Cancel Listing</h2>
              <button
                onClick={() => { setShowCancelModal(false); setSelectedListing(null); }}
                className={styles.closeButton}
              >
                <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.cancelWarning}>
                <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3>Are you sure you want to cancel this listing?</h3>
                <p>The NFT will be returned to your wallet and removed from the marketplace.</p>
              </div>

              <div className={styles.purchasePreview}>
                <Image
                  src={selectedListing.metadata.image}
                  alt={selectedListing.metadata.name}
                  width={200}
                  height={200}
                  className={styles.modalNftImage}
                />
                <div className={styles.purchaseDetails}>
                  <h3 className={styles.modalNftTitle}>{selectedListing.metadata.name}</h3>
                  <div className={styles.modalPriceInfo}>
                    <span className={styles.modalPriceLabel}>Listed for:</span>
                    <span className={styles.modalPrice}>{selectedListing.priceInSOL} SOL</span>
                  </div>
                </div>
              </div>
              
              <div className={styles.modalActions}>
                <button
                  onClick={() => { setShowCancelModal(false); setSelectedListing(null); }}
                  className={styles.cancelButton}
                  disabled={isCancelling}
                >
                  Keep Listing
                </button>
                <button
                  onClick={() => handleCancelListing(selectedListing)}
                  disabled={isCancelling}
                  className={styles.destructiveButton}
                >
                  {isCancelling ? (
                    <>
                      <div className={styles.loadingSpinner}></div>
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel Listing
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default MarketplacePage;