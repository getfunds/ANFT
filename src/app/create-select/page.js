'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function CreateSelect() {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            Choose Your <span className={styles.gradientText}>Creation Method</span>
          </h1>
          <p className={styles.subtitle}>
            Select how you&apos;d like to create your NFT. Both methods provide a seamless path to minting and trading on Solana.
          </p>
        </div>

        <div className={styles.optionsGrid}>
          {/* AI Generation Option */}
          <div className={styles.optionCard} onClick={() => router.push('/create?method=ai')}>
            <div className={styles.optionIcon}>
              <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className={styles.optionTitle}>AI Generation</h2>
            <p className={styles.optionDescription}>
              Describe your vision in words and let advanced AI instantly create stunning, unique artwork. 
              Perfect for exploring creative ideas quickly and generating multiple variations.
            </p>
            <div className={styles.featuresList}>
              <div className={styles.feature}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Instant generation</span>
              </div>
              <div className={styles.feature}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Unlimited variations</span>
              </div>
              <div className={styles.feature}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Encrypted prompt storage</span>
              </div>
              <div className={styles.feature}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>No artistic skills needed</span>
              </div>
            </div>
            <div className={styles.optionButton}>
              Start with AI
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>

          {/* Digital Painting Option */}
          <div className={`${styles.optionCard} ${styles.paintCard}`} onClick={() => router.push('/paint')}>
            <div className={`${styles.optionIcon} ${styles.paintIcon}`}>
              <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <h2 className={styles.optionTitle}>Digital Painting</h2>
            <p className={styles.optionDescription}>
              Create original artwork with our professional digital painting studio featuring realistic brushes and tools. 
              Express your artistic vision with complete creative freedom.
            </p>
            <div className={styles.featuresList}>
              <div className={styles.feature}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Professional tools</span>
              </div>
              <div className={styles.feature}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Realistic brushes</span>
              </div>
              <div className={styles.feature}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Full creative control</span>
              </div>
              <div className={styles.feature}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>HD canvas (1920×1080)</span>
              </div>
            </div>
            <div className={styles.optionButton}>
              Open Studio
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>
            <strong>Same seamless flow:</strong> Regardless of which method you choose, you&apos;ll follow an identical, 
            streamlined process to mint your NFT and list it on the marketplace.
          </p>
        </div>
      </div>
    </div>
  );
}

