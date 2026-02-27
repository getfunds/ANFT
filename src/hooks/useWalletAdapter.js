/**
 * Custom hook to provide backward compatibility with old wallet context
 * Maps wallet-adapter hooks to the old API
 */

import { useWallet as useWalletAdapter } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';

export function useWallet() {
  const wallet = useWalletAdapter();

  return useMemo(() => {
    // Create a wallet object compatible with Anchor's Wallet interface
    const anchorWallet = wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions
      ? {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions: wallet.signAllTransactions,
        }
      : null;

    return {
      // Wallet-adapter properties
      ...wallet,
      
      // Backward compatibility mappings
      isConnected: wallet.connected,
      accountId: wallet.publicKey?.toBase58() || null,
      walletAdapter: anchorWallet, // Use Anchor-compatible wallet object
      
      // Keep original properties for new code
      publicKey: wallet.publicKey,
      connected: wallet.connected,
      connecting: wallet.connecting,
      disconnecting: wallet.disconnecting,
    };
  }, [wallet]);
}
