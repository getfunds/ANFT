'use client';

import { useEffect } from 'react';
import { useWallet, WALLET_TYPES } from '../context/WalletContext';
import styles from './WalletModal.module.css';

const WalletModal = () => {
  const { 
    showWalletModal, 
    setShowWalletModal, 
    connect, 
    isLoading 
  } = useWallet();

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showWalletModal) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [showWalletModal]);

  if (!showWalletModal) return null;

  const handleWalletSelect = async (walletType) => {
    await connect(walletType);
  };

  const handleClose = () => {
    if (!isLoading) {
      setShowWalletModal(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h2 className={styles.title}>Connect Your Wallet</h2>
              <p className={styles.subtitle}>Choose a Solana wallet to get started</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className={styles.closeButton}
            disabled={isLoading}
            aria-label="Close modal"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Phantom Wallet Card */}
          <div className={styles.walletCard}>
            <div className={styles.walletCardHeader}>
              <div className={styles.walletIconLarge}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="url(#phantom-gradient)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <defs>
                    <linearGradient id="phantom-gradient" x1="2" y1="2" x2="22" y2="12" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#AB9FF2"/>
                      <stop offset="1" stopColor="#6366F1"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className={styles.walletInfo}>
                <h3 className={styles.walletName}>Phantom</h3>
                <p className={styles.walletDescription}>
                  The most popular Solana wallet
                </p>
              </div>
            </div>

            <button
              onClick={() => handleWalletSelect(WALLET_TYPES.PHANTOM)}
              disabled={isLoading}
              className={styles.connectWalletButton}
            >
              {isLoading ? (
                <>
                  <div className={styles.spinner}></div>
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Connect Phantom</span>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Features */}
          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h4 className={styles.featureTitle}>Secure & Private</h4>
                <p className={styles.featureDescription}>Your keys, your crypto</p>
              </div>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h4 className={styles.featureTitle}>Fast Transactions</h4>
                <p className={styles.featureDescription}>Sub-second finality on Solana</p>
              </div>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h4 className={styles.featureTitle}>Full Control</h4>
                <p className={styles.featureDescription}>Manage all your digital assets</p>
              </div>
            </div>
          </div>

          {/* Help Section */}
          <div className={styles.helpSection}>
            <div className={styles.helpIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className={styles.helpContent}>
              <h4 className={styles.helpTitle}>Don&apos;t have Phantom?</h4>
              <p className={styles.helpDescription}>
                Download the Phantom browser extension to get started with ANFT on Solana
              </p>
              <a 
                href="https://phantom.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.downloadLink}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Phantom</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
