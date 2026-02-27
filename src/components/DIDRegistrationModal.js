'use client';

import { useState, useEffect } from 'react';
import styles from './DIDRegistrationModal.module.css';

/**
 * DID Registration Modal Component (Solana)
 * 
 * Prompts the user for a unique username to register their on-chain DID.
 * Username is validated client-side before submission.
 * The actual register_did instruction is bundled atomically in the mint tx.
 */
export default function DIDRegistrationModal({ 
  isOpen, 
  onClose, 
  onRegister, 
  accountId,
  isRegistering = false 
}) {
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setUsernameError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateUsername = (value) => {
    if (!value || value.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (value.length > 32) {
      return 'Username must be at most 32 characters';
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      return 'Only lowercase letters, numbers, and hyphens allowed';
    }
    return '';
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setUsername(value);
    setUsernameError(value ? validateUsername(value) : '');
  };

  const handleRegister = async () => {
    const error = validateUsername(username);
    if (error) {
      setUsernameError(error);
      return;
    }
    await onRegister({ username });
  };

  const isValid = username.length >= 3 && !usernameError;

  return (
    <div className={styles.modalOverlay} onClick={isRegistering ? undefined : onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button 
          className={styles.closeButton} 
          onClick={onClose}
          disabled={isRegistering}
          aria-label="Close"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className={styles.stepContent}>
          <div className={styles.iconWrapper}>
            <svg width="80" height="80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className={styles.stepTitle}>Choose Your Creator Username</h3>
          <p className={styles.stepDescription}>
            Your username is your on-chain identity on Solana. It&apos;s unique, permanent, and linked to every NFT you create.
          </p>

          <div className={styles.benefitsList}>
            <div className={styles.benefit}>
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>Verified Creator Identity:</strong> Your artwork is linked to your on-chain DID</span>
            </div>
            <div className={styles.benefit}>
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>Immutable Attestations:</strong> Each NFT includes proof of authenticity on Solana</span>
            </div>
            <div className={styles.benefit}>
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>Searchable Profile:</strong> Anyone can find your work at /did/{'{username}'}</span>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Username <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="e.g. alice-art"
              className={`${styles.input} ${usernameError ? styles.inputError : ''}`}
              maxLength={32}
              disabled={isRegistering}
              autoFocus
            />
            {usernameError && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '4px' }}>
                {usernameError}
              </div>
            )}
            <div className={styles.charCount}>
              {username.length}/32 &middot; lowercase letters, numbers, hyphens
            </div>
          </div>

          <div className={styles.accountInfo}>
            <div className={styles.accountLabel}>Connected Wallet:</div>
            <div className={styles.accountId}>
              {accountId ? `${accountId.substring(0, 6)}...${accountId.substring(accountId.length - 4)}` : ''}
            </div>
          </div>

          <div className={styles.infoBox}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Your DID will be registered on Solana as part of your first NFT mint transaction. Username uniqueness is enforced by the blockchain.</p>
          </div>

          {isRegistering && (
            <div className={styles.progressBox}>
              <div className={styles.progressBoxTitle}>
                <div className={styles.spinner}></div>
                <span>Preparing your Decentralized Identity...</span>
              </div>
            </div>
          )}

          <div className={styles.buttonGroup}>
            <button onClick={onClose} className={styles.secondaryButton} disabled={isRegistering}>
              Cancel
            </button>
            <button 
              onClick={handleRegister} 
              className={styles.createButton} 
              disabled={isRegistering || !isValid}
            >
              {isRegistering ? (
                <>
                  <div className={styles.spinner}></div>
                  Preparing...
                </>
              ) : (
                <>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Continue with &quot;{username || '...'}&quot;
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
