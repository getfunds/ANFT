'use client';

import { useState } from 'react';
import { formatDID } from '../utils/solanaDID';
import { getSolanaExplorerUrl } from '../utils/sasAttestation';
import styles from './DIDProfileView.module.css';

const IPFS_GATEWAY = 'https://ipfs.filebase.io/ipfs/';
const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';

function formatWallet(addr) {
  if (!addr) return '—';
  return addr.length > 12 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;
}

function InlineCopy({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* fallback */ }
  };
  return (
    <button onClick={handleCopy} className={styles.inlineCopyBtn} title={copied ? 'Copied!' : 'Copy to clipboard'}>
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
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function NFTCard({ att, index }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = att.imageCID ? `${IPFS_GATEWAY}${att.imageCID}` : null;

  return (
    <div className={styles.card}>
      <div className={styles.cardImage}>
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={att.nftName || `NFT #${index + 1}`}
            className={styles.nftImg}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className={styles.imgPlaceholder}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className={styles.cardBody}>
        <h4 className={styles.cardTitle}>{att.nftName || `NFT #${index + 1}`}</h4>
        {att.nftDescription && (
          <p className={styles.cardDesc}>{att.nftDescription}</p>
        )}

        <div className={styles.cardMeta}>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Mint</span>
            <span className={styles.metaValueMono}>
              <a href={getSolanaExplorerUrl(att.nftMintAddress, cluster)} target="_blank" rel="noopener noreferrer" className={styles.mintLink}>{formatWallet(att.nftMintAddress)}</a>
              <InlineCopy text={att.nftMintAddress} />
            </span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Network</span>
            <span className={styles.metaValue}>{att.network || 'devnet'}</span>
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
}

export default function DIDProfileView({ profile, attestations, isLoadingAttestations }) {
  return (
    <div className={styles.container}>
      {/* Profile Header */}
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
            <span className={styles.statNum}>{attestations.length || profile.attestationCount || 0}</span>
            <span className={styles.statLabel}>NFTs</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statNum}>{formatDate(profile.createdAt)}</span>
            <span className={styles.statLabel}>Member Since</span>
          </div>
        </div>
      </div>

      {/* NFT Grid */}
      <div className={styles.nftSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            Collection
            {isLoadingAttestations && <span className={styles.spinner} />}
          </h3>
          {attestations.length > 0 && (
            <span className={styles.countBadge}>{attestations.length} item{attestations.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {!isLoadingAttestations && attestations.length === 0 && (
          <div className={styles.emptyNfts}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>No NFTs minted yet</p>
          </div>
        )}

        {attestations.length > 0 && (
          <div className={styles.nftGrid}>
            {attestations.map((att, i) => (
              <NFTCard key={att.attestationAddress || i} att={att} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
