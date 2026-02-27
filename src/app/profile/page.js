'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import { checkExistingDID, getProgram, formatDID } from '../../utils/solanaDID';
import { fetchAttestationsForDID, getSolanaExplorerUrl } from '../../utils/sasAttestation';
import { getConnection } from '../../utils/solanaWallet';
import { useWallet } from '../../hooks/useWalletAdapter';
import { getAccountNFTs, processNFTData, filterRealNFTs } from '../../utils/nftUtils';
import { decryptPrompt } from '../../utils/aiImageGeneration';
import ListNFTModal from '../../components/ListNFTModal';
import Image from 'next/image';
import Link from 'next/link';
import styles from './profile.module.css';

const IPFS_GATEWAY = 'https://ipfs.filebase.io/ipfs/';
const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';

function formatWallet(addr) {
  if (!addr) return '—';
  return addr.length > 12 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;
}

function InlineCopy({ text, variant }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* fallback */ }
  };
  const cls = variant === 'detail' ? styles.detailCopyBtn : styles.inlineCopyBtn;
  return (
    <button onClick={handleCopy} className={cls} title={copied ? 'Copied!' : 'Copy to clipboard'}>
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      )}
    </button>
  );
}

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  const d = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ProfilePage() {
  const { publicKey, connected } = useSolanaWallet();
  const { isConnected, accountId, walletAdapter } = useWallet();

  const [profile, setProfile] = useState(null);
  const [attestations, setAttestations] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingAtts, setLoadingAtts] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [ownedNfts, setOwnedNfts] = useState([]);
  const [loadingNfts, setLoadingNfts] = useState(false);
  const [nftsError, setNftsError] = useState('');
  const [activeTab, setActiveTab] = useState('created');
  const [selectedNft, setSelectedNft] = useState(null);
  const [showListModal, setShowListModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [decryptedPrompt, setDecryptedPrompt] = useState('');
  const [nftListingStatus, setNftListingStatus] = useState({});
  const [cancellingListing, setCancellingListing] = useState(null);

  useEffect(() => {
    if (connected && publicKey) {
      loadProfile();
    } else {
      setProfile(null);
      setAttestations([]);
      setProfileError('');
    }
  }, [connected, publicKey]);

  useEffect(() => {
    if (isConnected && accountId) {
      loadOwnedNfts();
    } else {
      setOwnedNfts([]);
    }
  }, [isConnected, accountId]);

  const loadProfile = async () => {
    if (!publicKey) return;
    try {
      setLoadingProfile(true);
      setProfileError('');
      setProfile(null);
      setAttestations([]);

      const connection = getConnection();
      const readOnlyProvider = new AnchorProvider(
        connection,
        { publicKey, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs },
        { preflightCommitment: 'confirmed' }
      );
      const program = getProgram(readOnlyProvider);
      const result = await checkExistingDID(program, publicKey);

      if (!result) {
        setProfileError('no-did');
        return;
      }

      setProfile(result);

      setLoadingAtts(true);
      try {
        const atts = await fetchAttestationsForDID(result.did);
        setAttestations(atts);
      } catch {
      } finally {
        setLoadingAtts(false);
      }
    } catch {
      setProfileError('Failed to load profile');
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadOwnedNfts = async () => {
    try {
      setLoadingNfts(true);
      setNftsError('');
      const rawNfts = await getAccountNFTs(accountId);
      const processedNfts = await processNFTData(rawNfts, accountId);
      const realNfts = filterRealNFTs(processedNfts);
      setOwnedNfts(realNfts);
      if (realNfts.length > 0) {
        checkAllListingStatuses(realNfts);
      }
    } catch (err) {
      setNftsError(err.message);
    } finally {
      setLoadingNfts(false);
    }
  };

  const checkAllListingStatuses = async (nfts) => {
    setNftListingStatus({});
    const promises = nfts.map(async (nft) => {
      try {
        const response = await fetch(
          `/api/marketplace/check-listing?tokenAddress=${nft.tokenId}&tokenId=${nft.serialNumber}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.isListed) {
            const listingKey = `${nft.tokenId}-${nft.serialNumber}`;
            setNftListingStatus(prev => ({ ...prev, [listingKey]: data.listing }));
          }
        }
      } catch {}
    });
    await Promise.all(promises);
  };

  const handleCancelListing = async (nft) => {
    const listingKey = `${nft.tokenId}-${nft.serialNumber}`;
    const listing = nftListingStatus[listingKey];
    if (!listing) return;
    const confirmCancel = window.confirm(
      `Cancel listing for "${nft.name}"?\nListed Price: ${listing.price} SOL`
    );
    if (!confirmCancel) return;
    setCancellingListing(nft.id);
    try {
      const { cancelListing: cancelMarketplaceListing } = await import('../../utils/marketplace');
      await cancelMarketplaceListing(nft.tokenId, walletAdapter, accountId);
      const newStatusMap = { ...nftListingStatus };
      delete newStatusMap[listingKey];
      setNftListingStatus(newStatusMap);
    } catch (error) {
      alert(`Failed to cancel listing: ${error.message}`);
    } finally {
      setCancellingListing(null);
    }
  };

  const handleListForSale = (nft) => {
    setSelectedNft(nft);
    setShowListModal(true);
  };

  const handleListingSuccess = async (result) => {
    if (selectedNft) {
      let listingFound = false;
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 2000 + i * 1000));
        try {
          const response = await fetch(
            `/api/marketplace/check-listing?tokenAddress=${selectedNft.tokenId}&tokenId=${selectedNft.serialNumber}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.isListed) {
              const listingKey = `${selectedNft.tokenId}-${selectedNft.serialNumber}`;
              setNftListingStatus(prev => ({ ...prev, [listingKey]: data.listing }));
              listingFound = true;
              break;
            }
          }
        } catch {}
      }
      if (!listingFound) checkAllListingStatuses(ownedNfts);
    }
    setShowListModal(false);
  };

  const handleViewPrompt = (nft) => {
    try {
      if (nft.owner !== accountId) {
        alert('Only the NFT owner can access the original prompt');
        return;
      }
      const prompt = decryptPrompt(nft.encryptedPrompt, accountId);
      setDecryptedPrompt(prompt);
      setShowPromptModal(true);
    } catch {
      alert('Failed to decrypt prompt.');
    }
  };

  const openExplorer = (address) => {
    const url = `https://explorer.solana.com/address/${address}?cluster=${cluster}`;
    window.open(url, '_blank');
  };

  const createdNfts = ownedNfts.filter(nft => nft.creator === accountId);
  const purchasedNfts = ownedNfts.filter(nft => nft.owner === accountId && nft.creator !== accountId);

  if (!connected) {
    return (
      <div className={styles.page}>
        <div className={styles.centeredMsg}>
          <div className={styles.iconWrap}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className={styles.msgTitle}>Connect Your Wallet</h2>
          <p className={styles.msgText}>Connect a Solana wallet to view your profile, created NFTs, and collection</p>
        </div>
      </div>
    );
  }

  if (loadingProfile && loadingNfts) {
    return (
      <div className={styles.page}>
        <div className={styles.centeredMsg}>
          <span className={styles.spinner} />
          <p className={styles.msgText}>Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {loadingProfile ? (
        <div className={styles.profileCardLoading}>
          <span className={styles.spinner} />
          <p>Loading profile...</p>
        </div>
      ) : profile ? (
        <div className={styles.profileCard}>
          <div className={styles.profileTop}>
            <div className={styles.profileLeft}>
              <div className={styles.avatar}>
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div className={styles.profileInfo}>
                <h2 className={styles.username}>@{profile.username}</h2>
                <div className={styles.didRow}>
                  <span className={styles.didFull}>{profile.did}</span>
                  <InlineCopy text={profile.did} />
                </div>
              </div>
            </div>
            <div className={styles.walletBlock}>
              <span className={styles.walletLabel}>Wallet</span>
              <div className={styles.walletRow}>
                <a href={getSolanaExplorerUrl(profile.currentWallet, cluster)} target="_blank" rel="noopener noreferrer" className={styles.walletAddr}>{formatWallet(profile.currentWallet)}</a>
                <InlineCopy text={profile.currentWallet} />
              </div>
            </div>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{attestations.length}</span>
              <span className={styles.statLabel}>Created</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{ownedNfts.length}</span>
              <span className={styles.statLabel}>Total NFTs</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{purchasedNfts.length}</span>
              <span className={styles.statLabel}>Collected</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{formatDate(profile.createdAt)}</span>
              <span className={styles.statLabel}>Member Since</span>
            </div>
          </div>
        </div>
      ) : profileError === 'no-did' ? (
        <div className={styles.profileCardEmpty}>
          <div className={styles.iconWrap}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className={styles.msgTitle}>No DID Found</h3>
          <p className={styles.msgText}>Create your first NFT to register a decentralized identity.</p>
          <a href="/create-select" className={styles.ctaBtn}>Create NFT</a>
        </div>
      ) : profileError ? (
        <div className={styles.profileCardEmpty}>
          <p className={styles.errorText}>{profileError}</p>
          <button onClick={loadProfile} className={styles.retryBtn}>Retry</button>
        </div>
      ) : (
        <div className={styles.profileCardLoading}>
          <span className={styles.spinner} />
        </div>
      )}

      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          <button
            onClick={() => setActiveTab('created')}
            className={`${styles.tab} ${activeTab === 'created' ? styles.tabActive : ''}`}
          >
            Created NFTs
            <span className={styles.tabCount}>{loadingAtts ? '...' : attestations.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('owned')}
            className={`${styles.tab} ${activeTab === 'owned' ? styles.tabActive : ''}`}
          >
            Owned NFTs
            <span className={styles.tabCount}>{loadingNfts ? '...' : ownedNfts.length}</span>
          </button>
        </div>
      </div>

      {activeTab === 'created' && (
        <div className={styles.nftSection}>
          {loadingAtts ? (
            <div className={styles.sectionLoading}>
              <span className={styles.spinner} />
              <p>Loading created NFTs...</p>
            </div>
          ) : attestations.length === 0 ? (
            <div className={styles.sectionEmpty}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No NFTs created yet</p>
              <Link href="/create-select" className={styles.ctaBtn}>Create Your First NFT</Link>
            </div>
          ) : (
            <div className={styles.nftGrid}>
              {attestations.map((att, i) => {
                const imgSrc = att.imageCID ? `${IPFS_GATEWAY}${att.imageCID}` : null;
                return (
                  <div key={att.attestationAddress || i} className={styles.nftCard}>
                    <div className={styles.nftImageContainer}>
                      {imgSrc ? (
                        <img src={imgSrc} alt={att.nftName || `NFT #${i + 1}`} className={styles.nftImg} loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className={styles.imgPlaceholder}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <span className={styles.cardBadgeCreated}>Created</span>
                    </div>
                    <div className={styles.nftCardBody}>
                      <h4 className={styles.nftCardTitle}>{att.nftName || `NFT #${i + 1}`}</h4>
                      {att.nftDescription && <p className={styles.nftCardDesc}>{att.nftDescription}</p>}
                      <div className={styles.nftCardMeta}>
                        <div className={styles.metaRow}>
                          <span className={styles.metaLabel}>Mint</span>
                          <a href={getSolanaExplorerUrl(att.nftMintAddress, cluster)} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
                            {formatWallet(att.nftMintAddress)}
                          </a>
                        </div>
                        {att.timestamp && (
                          <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Minted</span>
                            <span className={styles.metaValue}>{formatDate(att.timestamp)}</span>
                          </div>
                        )}
                        {att.royaltyBps > 0 && (
                          <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Royalty</span>
                            <span className={styles.metaValue}>{(att.royaltyBps / 100).toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'owned' && (
        <div className={styles.nftSection}>
          {loadingNfts ? (
            <div className={styles.sectionLoading}>
              <span className={styles.spinner} />
              <p>Loading your NFT collection...</p>
            </div>
          ) : nftsError ? (
            <div className={styles.sectionEmpty}>
              <p className={styles.errorText}>{nftsError}</p>
              <button onClick={loadOwnedNfts} className={styles.retryBtn}>Retry</button>
            </div>
          ) : ownedNfts.length === 0 ? (
            <div className={styles.sectionEmpty}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p>No NFTs in your wallet yet</p>
              <Link href="/marketplace" className={styles.ctaBtn}>Browse Marketplace</Link>
            </div>
          ) : (
            <div className={styles.nftGrid}>
              {ownedNfts.map((nft) => {
                const listingKey = `${nft.tokenId}-${nft.serialNumber}`;
                const isListed = !!nftListingStatus[listingKey];
                const listing = nftListingStatus[listingKey];
                const isCancelling = cancellingListing === nft.id;

                return (
                  <div key={nft.id} className={styles.nftCard}>
                    <div className={styles.nftImageContainer}>
                      {nft.image && !nft.image.includes('/placeholder-nft.svg') ? (
                        <Image src={nft.image} alt={nft.name} fill className={styles.nftImg} onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className={styles.imgPlaceholder}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      {isListed && <span className={styles.cardBadgeListed}>Listed</span>}
                      {nft.creator === accountId && !isListed && <span className={styles.cardBadgeCreated}>Created</span>}
                    </div>
                    <div className={styles.nftCardBody}>
                      <h4 className={styles.nftCardTitle}>{nft.name}</h4>
                      {nft.description && <p className={styles.nftCardDesc}>{nft.description}</p>}
                      <div className={styles.nftCardMeta}>
                        <div className={styles.metaRow}>
                          <span className={styles.metaLabel}>Mint</span>
                          <a href={`https://explorer.solana.com/address/${nft.tokenId}?cluster=${cluster}`} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
                            {formatWallet(nft.tokenId)}
                          </a>
                        </div>
                        {nft.createdAt && (
                          <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Created</span>
                            <span className={styles.metaValue}>{formatDate(nft.createdAt)}</span>
                          </div>
                        )}
                        {isListed && (
                          <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Price</span>
                            <span className={styles.metaValuePrice}>{listing.price} SOL</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.nftCardActions}>
                        {isListed ? (
                          <button onClick={() => handleCancelListing(nft)} disabled={isCancelling} className={styles.btnDanger}>
                            {isCancelling ? 'Cancelling...' : 'Cancel Listing'}
                          </button>
                        ) : (
                          <button onClick={() => handleListForSale(nft)} className={styles.btnPrimary}>
                            List for Sale
                          </button>
                        )}
                        <button onClick={() => { setSelectedNft(nft); setShowDetailModal(true); }} className={styles.btnSecondary}>
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showDetailModal && selectedNft && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowDetailModal(false); }}>
          <div className={styles.detailModal}>
            <button onClick={() => setShowDetailModal(false)} className={styles.detailCloseBtn}>
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className={styles.detailHero}>
              {selectedNft.image && <Image src={selectedNft.image} alt={selectedNft.name} fill className={styles.detailHeroImg} />}
            </div>

            <div className={styles.detailContent}>
              <h2 className={styles.detailName}>{selectedNft.name}</h2>
              {selectedNft.description && <p className={styles.detailDesc}>{selectedNft.description}</p>}

              <div className={styles.detailInfoList}>
                <div className={styles.detailInfoRow}>
                  <span className={styles.detailInfoLabel}>Mint Address</span>
                  <div className={styles.detailInfoValueRow}>
                    <span className={styles.detailInfoValue}>{selectedNft.tokenId}</span>
                    <InlineCopy text={selectedNft.tokenId} variant="detail" />
                  </div>
                </div>
                {selectedNft.creator_did && (
                  <div className={styles.detailInfoRow}>
                    <span className={styles.detailInfoLabel}>Creator DID</span>
                    <div className={styles.detailInfoValueRow}>
                      <span className={styles.detailInfoValue}>{selectedNft.creator_did}</span>
                      <InlineCopy text={selectedNft.creator_did} variant="detail" />
                    </div>
                  </div>
                )}
                {selectedNft.creator && (
                  <div className={styles.detailInfoRow}>
                    <span className={styles.detailInfoLabel}>Creator</span>
                    <div className={styles.detailInfoValueRow}>
                      <span className={styles.detailInfoValue}>{selectedNft.creator}</span>
                      <InlineCopy text={selectedNft.creator} variant="detail" />
                    </div>
                  </div>
                )}
                {selectedNft.createdAt && (
                  <div className={styles.detailInfoRow}>
                    <span className={styles.detailInfoLabel}>Created</span>
                    <div className={styles.detailInfoValueRow}>
                      <span className={styles.detailInfoValue}>{formatDate(selectedNft.createdAt)}</span>
                    </div>
                  </div>
                )}
                {selectedNft.attributes && selectedNft.attributes
                  .filter(a => typeof a.value !== 'object' && a.trait_type !== 'Token ID' && a.trait_type !== 'Network')
                  .map((attr, i) => (
                    <div key={i} className={styles.detailInfoRow}>
                      <span className={styles.detailInfoLabel}>{attr.trait_type}</span>
                      <div className={styles.detailInfoValueRow}>
                        <span className={styles.detailInfoValue}>{attr.value}</span>
                      </div>
                    </div>
                  ))}
              </div>

              <div className={styles.detailActions}>
                <button onClick={() => openExplorer(selectedNft.tokenId)} className={styles.detailBtnOutline}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Explorer
                </button>
                {selectedNft.encryptedPrompt && (
                  <button onClick={() => handleViewPrompt(selectedNft)} className={styles.detailBtnPrimary}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    View Prompt
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPromptModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Original Prompt</h2>
              <button onClick={() => setShowPromptModal(false)} className={styles.closeBtn}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <blockquote className={styles.promptQuote}>&ldquo;{decryptedPrompt}&rdquo;</blockquote>
              <button onClick={() => { navigator.clipboard.writeText(decryptedPrompt); }} className={styles.btnPrimary} style={{width:'100%',marginTop:'1rem'}}>
                Copy Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      <ListNFTModal
        nft={selectedNft}
        isOpen={showListModal}
        onClose={() => setShowListModal(false)}
        onSuccess={handleListingSuccess}
      />
    </div>
  );
}
