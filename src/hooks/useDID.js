/**
 * React Hook for Decentralized Identity (DID) Management
 * 
 * This hook provides:
 * - DID status checking via Solana on-chain PDA
 * - DID registration flow (username-based)
 * - Pre-mint DID verification
 * 
 * DID registration happens atomically inside the mint transaction.
 * This hook only checks state and manages the modal flow.
 */

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  checkExistingDID,
  deriveDidProfilePDA,
  deriveWalletLookupPDA,
  getProgram,
  ANFT_PROGRAM_ID,
  validateUsername,
} from '../utils/solanaDID';
import { createAnchorProvider } from '../utils/solanaWallet';

export function useDID(accountId, walletAdapter) {
  const [didInfo, setDidInfo] = useState(null);
  const [isLoadingDID, setIsLoadingDID] = useState(false);
  const [didError, setDidError] = useState(null);
  const [hasDID, setHasDID] = useState(false);
  const [showDIDModal, setShowDIDModal] = useState(false);

  /**
   * Check if wallet has an existing DID on-chain
   */
  const checkDID = useCallback(async () => {
    if (!accountId || !walletAdapter) {
      return null;
    }

    try {
      setIsLoadingDID(true);
      setDidError(null);

      const provider = createAnchorProvider(walletAdapter);
      const program = getProgram(provider);
      const wallet = new PublicKey(accountId);

      const existingDID = await checkExistingDID(program, wallet);

      if (existingDID) {
        setDidInfo(existingDID);
        setHasDID(true);
        return existingDID;
      } else {
        setHasDID(false);
        return null;
      }
    } catch (error) {
      setDidError(error.message);
      setHasDID(false);
      return null;
    } finally {
      setIsLoadingDID(false);
    }
  }, [accountId, walletAdapter]);

  const ensureDIDBeforeMint = useCallback(async () => {
    const existingDID = await checkDID();
    if (existingDID) {
      return existingDID;
    }
    setShowDIDModal(true);
    return new Promise((resolve, reject) => {
      window.__didRegistrationResolve = resolve;
      window.__didRegistrationReject = reject;
    });
  }, [checkDID]);

  const completeDIDRegistration = useCallback(async (metadata) => {
    try {
      setIsLoadingDID(true);
      setDidError(null);

      const username = metadata.username;
      const validation = validateUsername(username);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const [didProfilePDA] = deriveDidProfilePDA(username);
      const didString = `did:anft:${didProfilePDA.toBase58()}`;

      const newDID = {
        did: didString,
        username: username,
        pdaAddress: didProfilePDA.toBase58(),
        currentWallet: accountId,
        originalWallet: accountId,
        createdAt: Math.floor(Date.now() / 1000),
        attestationCount: 0,
        isNew: true,
      };

      setDidInfo(newDID);
      setHasDID(true);
      setShowDIDModal(false);

      if (window.__didRegistrationResolve) {
        window.__didRegistrationResolve(newDID);
        delete window.__didRegistrationResolve;
        delete window.__didRegistrationReject;
      }

      return newDID;
    } catch (error) {
      setDidError(error.message);

      if (window.__didRegistrationReject) {
        window.__didRegistrationReject(error);
        delete window.__didRegistrationResolve;
        delete window.__didRegistrationReject;
      }

      throw error;
    } finally {
      setIsLoadingDID(false);
    }
  }, [accountId]);

  /**
   * Cancel DID registration
   */
  const cancelDIDRegistration = useCallback(() => {
    setShowDIDModal(false);

    if (window.__didRegistrationReject) {
      window.__didRegistrationReject(new Error('DID registration cancelled by user'));
      delete window.__didRegistrationResolve;
      delete window.__didRegistrationReject;
    }
  }, []);

  // Reset DID state when account changes
  useEffect(() => {
    if (!accountId) {
      setDidInfo(null);
      setHasDID(false);
      setDidError(null);
    }
  }, [accountId]);

  return {
    // State
    didInfo,
    hasDID,
    isLoadingDID,
    didError,
    showDIDModal,

    // Functions
    checkDID,
    ensureDIDBeforeMint,
    completeDIDRegistration,
    cancelDIDRegistration,
    setShowDIDModal,
  };
}

export default useDID;
