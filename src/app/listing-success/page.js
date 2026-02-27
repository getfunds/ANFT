'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';

function ListingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [nftData, setNftData] = useState(null);

  useEffect(() => {
    // Get NFT data from URL params
    const name = searchParams.get('name');
    const price = searchParams.get('price');
    const tokenId = searchParams.get('tokenId');
    const image = searchParams.get('image');

    if (name && price && tokenId) {
      setNftData({
        name: decodeURIComponent(name),
        price: decodeURIComponent(price),
        tokenId: decodeURIComponent(tokenId),
        image: image ? decodeURIComponent(image) : null
      });
    }
  }, [searchParams]);

  return (
    <div className={styles.container}>
      <div className={styles.successCard}>
        {/* Success Icon */}
        <div className={styles.iconWrapper}>
          <div className={styles.checkmarkCircle}>
            <svg className={styles.checkmark} viewBox="0 0 52 52">
              <circle className={styles.checkmarkCirclePath} cx="26" cy="26" r="25" fill="none"/>
              <path className={styles.checkmarkCheck} fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
          </div>
        </div>

        {/* Success Message */}
        <h1 className={styles.title}>NFT Listed Successfully!</h1>
        <p className={styles.description}>
          Your NFT has been successfully listed on the marketplace and is now available for purchase.
        </p>

        {/* NFT Details */}
        {nftData && (
          <div className={styles.nftPreview}>
            {nftData.image && (
              <div className={styles.nftImageWrapper}>
                <Image
                  src={nftData.image}
                  alt={nftData.name}
                  width={200}
                  height={200}
                  className={styles.nftImage}
                />
              </div>
            )}
            <div className={styles.nftDetails}>
              <div className={styles.nftName}>{nftData.name}</div>
              <div className={styles.nftPrice}>
                <span className={styles.priceLabel}>Listed for:</span>
                <span className={styles.priceValue}>{nftData.price} SOL</span>
              </div>
              <div className={styles.nftToken}>
                <span className={styles.tokenLabel}>Token ID:</span>
                <span className={styles.tokenValue}>{nftData.tokenId}</span>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className={styles.infoBox}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Your NFT is now visible on the marketplace and can be purchased by anyone.</span>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <Link href="/marketplace" className={styles.primaryButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            View Marketplace
          </Link>
          
          <Link href="/create-select" className={styles.secondaryButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Another NFT
          </Link>
        </div>

        {/* Additional Action */}
        <Link href="/profile" className={styles.linkButton}>
          ← Back to My Profile
        </Link>
      </div>
    </div>
  );
}

export default function ListingSuccessPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.iconWrapper}>
            <div className={styles.checkmarkCircle}>
              <svg className={styles.checkmark} viewBox="0 0 52 52">
                <circle className={styles.checkmarkCirclePath} cx="26" cy="26" r="25" fill="none"/>
              </svg>
            </div>
          </div>
          <h1 className={styles.title}>Loading...</h1>
        </div>
      </div>
    }>
      <ListingSuccessContent />
    </Suspense>
  );
}

