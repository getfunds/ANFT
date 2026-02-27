import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../hooks/useWalletAdapter';
import { createMarketplaceListing } from '../utils/marketplace';
import styles from './ListNFTModal.module.css';

const ListNFTModal = ({ nft, isOpen, onClose, onSuccess }) => {
  const router = useRouter();
  const { accountId, walletAdapter } = useWallet();
  const [listingType, setListingType] = useState('fixed');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('604800');
  const [royaltyPercentage, setRoyaltyPercentage] = useState('500');
  const [royaltyRecipient, setRoyaltyRecipient] = useState('');
  const [isListing, setIsListing] = useState(false);
  const [error, setError] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!price || parseFloat(price) <= 0) {
      setError('Please enter a valid price');
      return;
    }

    try {
      setIsListing(true);
      setError(null);

      const result = await createMarketplaceListing({
        tokenAddress: nft.tokenId,
        tokenId: nft.serialNumber,
        price: price,
        duration: parseInt(duration),
        isAuction: listingType === 'auction',
        royaltyPercentage: parseInt(royaltyPercentage),
        royaltyRecipient: royaltyRecipient || accountId
      }, walletAdapter, accountId);

      if (onSuccess) onSuccess(result);
      onClose();
      resetForm();

      const successUrl = `/listing-success?name=${encodeURIComponent(nft.name)}&price=${encodeURIComponent(price)}&tokenId=${encodeURIComponent(nft.tokenId)}${nft.image ? `&image=${encodeURIComponent(nft.image)}` : ''}`;
      router.push(successUrl);

    } catch (error) {
      setError(error.message || 'Failed to create listing');
    } finally {
      setIsListing(false);
    }
  };

  const resetForm = () => {
    setListingType('fixed');
    setPrice('');
    setDuration('604800');
    setRoyaltyPercentage('500');
    setRoyaltyRecipient('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const formatDuration = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  };

  if (!isOpen || !nft) {
    return null;
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>

        {/* Full-screen loading overlay while transaction is processing */}
        {isListing && (
          <div className={styles.txOverlay}>
            <div className={styles.txSpinner} />
            <p className={styles.txTitle}>Listing your NFT...</p>
            <p className={styles.txSubtitle}>Please approve the transaction in your wallet</p>
          </div>
        )}

        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>List NFT for Sale</h2>
          <button onClick={handleClose} className={styles.closeButton} disabled={isListing}>
            <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          <form onSubmit={handleSubmit} className={styles.listingForm}>
              
              {/* NFT Preview */}
              <div className={styles.nftPreview}>
            <div className={styles.nftImageContainer}>
              {nft.image ? (
                <img
                  src={nft.image}
                  alt={nft.name}
                  className={styles.nftImage}
                />
              ) : (
                <div className={styles.nftImagePlaceholder}>
                  <svg className={styles.placeholderIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className={styles.nftInfo}>
              <h3 className={styles.nftName}>{nft.name}</h3>
              <p className={styles.nftDescription}>{nft.description}</p>
              <div className={styles.nftDetails}>
                <span>Token ID: {nft.tokenId}</span>
                <span>Serial: #{nft.serialNumber}</span>
              </div>
            </div>
          </div>

          {/* Price */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Price (SOL)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter price in SOL"
              className={styles.numberInput}
              required
            />
            <div className={styles.inputHint}>
              Minimum price: 0.01 SOL
            </div>
          </div>

          {/* Duration */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Listing Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={styles.selectInput}
            >
              <option value="86400">1 Day</option>
              <option value="259200">3 Days</option>
              <option value="604800">7 Days</option>
              <option value="1209600">14 Days</option>
              <option value="2592000">30 Days</option>
            </select>
            <div className={styles.inputHint}>
              Your {listingType === 'auction' ? 'auction' : 'listing'} will be active for {formatDuration(parseInt(duration))}
            </div>
          </div>

          {/* Royalty Settings */}
          <div className={styles.formSection}>
            <h4 className={styles.sectionTitle}>Royalty Settings</h4>
            <p className={styles.sectionDescription}>
              Set royalties for future sales of this NFT
            </p>
            
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Royalty Percentage</label>
                <select
                  value={royaltyPercentage}
                  onChange={(e) => setRoyaltyPercentage(e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="0">0% (No Royalties)</option>
                  <option value="250">2.5%</option>
                  <option value="500">5%</option>
                  <option value="750">7.5%</option>
                  <option value="1000">10%</option>
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Royalty Recipient</label>
                <input
                  type="text"
                  value={royaltyRecipient}
                  onChange={(e) => setRoyaltyRecipient(e.target.value)}
                  placeholder="Wallet address (leave empty to use your account)"
                  className={styles.textInput}
                />
              </div>
            </div>
            
            <div className={styles.inputHint}>
              Royalties are paid to the recipient on each future sale
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className={styles.feeBreakdown}>
            <h4 className={styles.sectionTitle}>Fee Breakdown</h4>
            <div className={styles.feeRow}>
              <span>Platform Fee (2.5%)</span>
              <span>{price ? (parseFloat(price) * 0.025).toFixed(2) : '0.00'} SOL</span>
            </div>
            <div className={styles.feeRow}>
              <span>Royalty Fee ({(parseInt(royaltyPercentage) / 100).toFixed(1)}%)</span>
              <span>{price ? (parseFloat(price) * parseInt(royaltyPercentage) / 10000).toFixed(2) : '0.00'} SOL</span>
            </div>
            <div className={styles.feeRow + ' ' + styles.totalRow}>
              <span><strong>You&apos;ll Receive</strong></span>
              <span><strong>
                {price ? (parseFloat(price) * (1 - 0.025 - parseInt(royaltyPercentage) / 10000)).toFixed(2) : '0.00'} SOL
              </strong></span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className={styles.errorMessage}>
              <svg className={styles.errorIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

              {/* Actions */}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={handleClose}
                  className={styles.cancelButton}
                  disabled={isListing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isListing || !price}
                  className={styles.listButton}
                >
                  {isListing ? (
                    <>
                      <div className={styles.loadingSpinner}></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      List NFT for Sale
                    </>
                  )}
                </button>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default ListNFTModal;
