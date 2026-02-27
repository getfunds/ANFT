'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';

/**
 * Format a Solana address for display (truncated)
 */
function formatAddress(address) {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function PurchaseSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const nftName = searchParams.get('name') || 'NFT';
  const tokenId = searchParams.get('tokenId') || '';
  const serialNumber = searchParams.get('serialNumber') || '';
  const transactionId = searchParams.get('transactionId') || '';
  const price = searchParams.get('price') || '';
  const imageUrl = searchParams.get('image') || '';
  
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  const explorerUrl = `https://explorer.solana.com/tx/${transactionId}${clusterParam}`;
  
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Success Icon */}
        <div className={styles.successIcon}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        
        {/* Success Message */}
        <h1 className={styles.title}>Congratulations!</h1>
        <p className={styles.subtitle}>
          You have successfully purchased your NFT
        </p>
        
        {/* NFT Preview */}
        {imageUrl && (
          <div className={styles.nftPreview}>
            <div className={styles.imageContainer}>
              <Image
                src={imageUrl}
                alt={nftName}
                fill
                className={styles.nftImage}
              />
            </div>
            <div className={styles.nftInfo}>
              <h2 className={styles.nftName}>{nftName}</h2>
              <div className={styles.nftDetails}>
                {tokenId && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Token ID:</span>
                    <span className={styles.detailValue}>{tokenId}</span>
                  </div>
                )}
                {serialNumber && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Serial:</span>
                    <span className={styles.detailValue}>#{serialNumber}</span>
                  </div>
                )}
                {price && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Price Paid:</span>
                    <span className={styles.detailValue}>{price} SOL</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className={styles.actions}>
          <Link href="/profile" className={styles.primaryButton}>
            <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            View My NFTs
          </Link>
          
          {transactionId && (
            <a 
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.secondaryButton}
            >
              <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Transaction on Solana Explorer
            </a>
          )}
          
          <Link href="/marketplace" className={styles.tertiaryButton}>
            Browse More NFTs
          </Link>
        </div>
        
        {/* Additional Info */}
        <div className={styles.infoBox}>
          <svg className={styles.infoIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className={styles.infoText}>
            Your NFT is now in your wallet and can be viewed in the &quot;My NFTs&quot; section. 
            The transaction has been recorded on the Solana network.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseSuccessPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.content}>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <PurchaseSuccessContent />
    </Suspense>
  );
}

