/**
 * Solana Wallet Utilities
 *
 * Solana wallet adapter support (Phantom, Solflare, Backpack)
 */

import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { AnchorProvider } from '@coral-xyz/anchor';

// Solana RPC URL
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  clusterApiUrl('devnet');

// Cluster name for explorer links
export const SOLANA_CLUSTER =
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';

/**
 * Get a Solana Connection instance
 * @returns {Connection}
 */
export function getConnection() {
  return new Connection(SOLANA_RPC_URL, 'confirmed');
}

/**
 * Detect available Solana wallets in the browser
 * @returns {Array<Object>} Available wallet descriptors
 */
export function getAvailableWallets() {
  if (typeof window === 'undefined') return [];

  const wallets = [];

  // Phantom
  if (window.solana && window.solana.isPhantom) {
    wallets.push({
      type: 'phantom',
      name: 'Phantom',
      icon: '👻',
      description: 'Popular Solana wallet',
      priority: 1,
      available: true,
      adapter: window.solana,
    });
  }

  // Solflare
  if (window.solflare && window.solflare.isSolflare) {
    wallets.push({
      type: 'solflare',
      name: 'Solflare',
      icon: '🔆',
      description: 'Solana wallet with staking',
      priority: 2,
      available: true,
      adapter: window.solflare,
    });
  }

  // Backpack
  if (window.backpack) {
    wallets.push({
      type: 'backpack',
      name: 'Backpack',
      icon: '🎒',
      description: 'Multi-chain wallet',
      priority: 3,
      available: true,
      adapter: window.backpack,
    });
  }

  console.log(`📱 Found ${wallets.length} available Solana wallet(s)`);
  return wallets;
}

/**
 * Connect to a Solana wallet
 * @param {string} walletType - 'phantom' | 'solflare' | 'backpack'
 * @returns {Promise<Object>} Connection result
 */
export async function connectWallet(walletType = 'phantom') {
  console.log(`🔗 Connecting to ${walletType} wallet...`);

  let adapter;

  switch (walletType) {
    case 'phantom':
      if (!window.solana || !window.solana.isPhantom) {
        throw new Error('Phantom wallet not found. Please install it from https://phantom.app/');
      }
      adapter = window.solana;
      break;
    case 'solflare':
      if (!window.solflare || !window.solflare.isSolflare) {
        throw new Error('Solflare wallet not found. Please install it from https://solflare.com/');
      }
      adapter = window.solflare;
      break;
    case 'backpack':
      if (!window.backpack) {
        throw new Error('Backpack wallet not found.');
      }
      adapter = window.backpack;
      break;
    default:
      throw new Error(`Unsupported wallet type: ${walletType}`);
  }

  try {
    const response = await adapter.connect();
    const publicKey = response.publicKey || adapter.publicKey;

    if (!publicKey) {
      throw new Error('No public key returned from wallet');
    }

    console.log('✅ Wallet connected:', publicKey.toBase58());

    return {
      publicKey: publicKey,
      accountId: publicKey.toBase58(),
      walletType,
      adapter,
    };
  } catch (error) {
    if (error.message.includes('User rejected')) {
      throw new Error('Connection rejected by user');
    }
    throw new Error(`Wallet connection failed: ${error.message}`);
  }
}

/**
 * Disconnect the current wallet
 * @param {Object} adapter - Wallet adapter instance
 */
export async function disconnectWallet(adapter) {
  try {
    if (adapter && typeof adapter.disconnect === 'function') {
      await adapter.disconnect();
    }
    console.log('✅ Wallet disconnected');
  } catch (error) {
    console.error('❌ Wallet disconnect error:', error);
  }
}

/**
 * Check if a wallet is connected
 * @param {Object} adapter - Wallet adapter instance
 * @returns {boolean}
 */
export function isWalletConnected(adapter) {
  if (!adapter) return false;
  return adapter.isConnected && adapter.publicKey != null;
}

/**
 * Get the connected wallet's public key
 * @param {Object} adapter - Wallet adapter instance
 * @returns {PublicKey|null}
 */
export function getWalletPublicKey(adapter) {
  if (!adapter || !adapter.publicKey) return null;
  return adapter.publicKey;
}

/**
 * Create an AnchorProvider from the connected wallet
 * @param {Object} walletOrAdapter - Wallet adapter instance or wallet object from useWallet
 * @returns {AnchorProvider}
 */
export function createAnchorProvider(walletOrAdapter) {
  const connection = getConnection();

  // Handle new wallet-adapter structure (from @solana/wallet-adapter-react)
  // The wallet object already has the correct interface
  if (walletOrAdapter && walletOrAdapter.signTransaction && walletOrAdapter.signAllTransactions) {
    return new AnchorProvider(connection, walletOrAdapter, {
      preflightCommitment: 'confirmed',
    });
  }

  // Handle old wallet adapter structure (fallback)
  const wallet = {
    publicKey: walletOrAdapter.publicKey,
    signTransaction: walletOrAdapter.signTransaction.bind(walletOrAdapter),
    signAllTransactions: walletOrAdapter.signAllTransactions.bind(walletOrAdapter),
  };

  return new AnchorProvider(connection, wallet, {
    preflightCommitment: 'confirmed',
  });
}

/**
 * Get Solana explorer URL for an address
 * @param {string} address
 * @param {string} type - 'address' | 'tx'
 * @returns {string}
 */
export function getExplorerUrl(address, type = 'address') {
  const cluster = SOLANA_CLUSTER === 'mainnet-beta' ? '' : `?cluster=${SOLANA_CLUSTER}`;
  return `https://explorer.solana.com/${type}/${address}${cluster}`;
}

console.log('✅ Solana wallet system loaded');

export default {
  SOLANA_RPC_URL,
  SOLANA_CLUSTER,
  getConnection,
  getAvailableWallets,
  connectWallet,
  disconnectWallet,
  isWalletConnected,
  getWalletPublicKey,
  createAnchorProvider,
  getExplorerUrl,
};
