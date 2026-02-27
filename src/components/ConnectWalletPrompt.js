'use client';

import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import styles from './ConnectWalletPrompt.module.css';

export default function ConnectWalletPrompt({ 
  title = "Connect Your Wallet",
  description = "Please connect your Solana wallet to continue."
}) {
  const { setVisible } = useWalletModal();

  return (
    <div className={styles.container}>
      <div className={styles.promptCard}>
        <div className={styles.iconWrapper}>
          <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
        
        <button 
          onClick={() => setVisible(true)}
          className={styles.connectButton}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Connect Wallet
        </button>
        
        <div className={styles.infoBox}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>We support Phantom and other Solana wallets</span>
        </div>
      </div>
    </div>
  );
}

