'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  getAvailableWallets as detectWallets,
  connectWallet as connectSolanaWallet,
  disconnectWallet as disconnectSolanaWallet,
  isWalletConnected as checkConnected,
  getWalletPublicKey,
} from '../utils/solanaWallet';

const WalletContext = createContext();

export const WALLET_TYPES = {
  PHANTOM: 'phantom',
  SOLFLARE: 'solflare',
  BACKPACK: 'backpack',
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [accountId, setAccountId] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableWallets, setAvailableWallets] = useState([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [connectedWalletType, setConnectedWalletType] = useState(null);
  const walletAdapterRef = useRef(null);

  useEffect(() => {
    // Detect available wallets after mount
    const timer = setTimeout(() => {
      const wallets = detectWallets();
      setAvailableWallets(wallets);

      // Auto-reconnect if Phantom was previously connected
      if (typeof window !== 'undefined' && window.solana && window.solana.isPhantom) {
        if (window.solana.isConnected && window.solana.publicKey) {
          walletAdapterRef.current = window.solana;
          setIsConnected(true);
          setPublicKey(window.solana.publicKey);
          setAccountId(window.solana.publicKey.toBase58());
          setConnectedWalletType(WALLET_TYPES.PHANTOM);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const connect = async (walletType = WALLET_TYPES.PHANTOM) => {
    try {
      setIsLoading(true);
      setError(null);
      setShowWalletModal(false);

      const result = await connectSolanaWallet(walletType);

      walletAdapterRef.current = result.adapter;
      setIsConnected(true);
      setPublicKey(result.publicKey);
      setAccountId(result.accountId);
      setConnectedWalletType(walletType);
      setIsLoading(false);
    } catch (error) {
      setError(`Connection failed: ${error.message}`);
      setIsLoading(false);
      setShowWalletModal(false);
    }
  };

  const disconnect = async () => {
    try {
      await disconnectSolanaWallet(walletAdapterRef.current);
      walletAdapterRef.current = null;
      setIsConnected(false);
      setAccountId(null);
      setPublicKey(null);
      setConnectedWalletType(null);
      setError(null);
    } catch (error) {
      setError(error.message);
    }
  };

  const value = {
    isConnected,
    accountId,
    publicKey,
    isLoading,
    error,
    availableWallets,
    showWalletModal,
    connectedWalletType,
    walletAdapter: walletAdapterRef.current,
    connect,
    disconnect,
    setShowWalletModal,
    clearError: () => setError(null),
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
