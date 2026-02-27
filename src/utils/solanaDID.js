/**
 * Solana DID - Client-Side Utilities
 * 
 * Manages DID operations via the anft_did Anchor program on Solana.
 * DID Format: did:anft:<pda_address>
 * PDA seeds: ["did", username] for DidProfile
 *            ["wallet-did", wallet_pubkey] for WalletLookup
 */

import { PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import IDL from './idl/anft_did.json';

// Program ID — read lazily to avoid top-level undefined during SSR/module init
export const ANFT_PROGRAM_ID = new PublicKey(
  'HuvfZBXs4mP3RnJQxcDPL2nbV52dn51S5yQEKaD833op'
);

/**
 * Get the Anchor program instance
 * @param {AnchorProvider} provider - Anchor provider with wallet + connection
 * @returns {Program} Anchor program
 */
export function getProgram(provider) {
  return new Program(IDL, provider);
}

/**
 * Derive DidProfile PDA from username
 * @param {string} username
 * @returns {[PublicKey, number]} [pda, bump]
 */
export function deriveDidProfilePDA(username) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('did'), Buffer.from(username)],
    ANFT_PROGRAM_ID
  );
}

/**
 * Derive WalletLookup PDA from wallet pubkey
 * @param {PublicKey} wallet
 * @returns {[PublicKey, number]} [pda, bump]
 */
export function deriveWalletLookupPDA(wallet) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('wallet-did'), wallet.toBuffer()],
    ANFT_PROGRAM_ID
  );
}

/**
 * Check if a wallet already has a DID by fetching its WalletLookup PDA
 * @param {Program} program - Anchor program
 * @param {PublicKey} wallet - Wallet public key
 * @returns {Promise<Object|null>} DidProfile data or null
 */
export async function checkExistingDID(program, wallet) {
  try {
    console.log('🔍 Checking for existing DID:', wallet.toBase58());

    const [walletLookupPDA] = deriveWalletLookupPDA(wallet);
    const lookup = await program.account.walletLookup.fetchNullable(walletLookupPDA);

    if (!lookup) {
      console.log('ℹ️ No DID found for this wallet');
      return null;
    }

    // Fetch the full DidProfile using the pda_address from lookup
    const profile = await program.account.didProfile.fetch(lookup.pdaAddress);

    // Verify account is owned by ANFT program
    const accountInfo = await program.provider.connection.getAccountInfo(lookup.pdaAddress);
    if (!accountInfo || !accountInfo.owner.equals(ANFT_PROGRAM_ID)) {
      console.warn('⚠️ DidProfile account not owned by ANFT program');
      return null;
    }

    console.log('✅ Found existing DID:', profile.did);

    return {
      did: profile.did,
      username: profile.username,
      pdaAddress: profile.pdaAddress.toBase58(),
      currentWallet: profile.currentWallet.toBase58(),
      originalWallet: profile.originalWallet.toBase58(),
      createdAt: profile.createdAt.toNumber(),
      attestationCount: profile.attestationCount.toNumber(),
      bump: profile.bump,
    };
  } catch (error) {
    console.error('❌ Error checking DID:', error);
    return null;
  }
}

/**
 * Build the register_did instruction (does NOT send — caller bundles into atomic tx)
 * @param {Program} program - Anchor program
 * @param {PublicKey} signer - Wallet public key
 * @param {string} username - Desired username
 * @returns {Promise<import('@solana/web3.js').TransactionInstruction>}
 */
export async function buildRegisterDidInstruction(program, signer, username) {
  const [didProfilePDA] = deriveDidProfilePDA(username);
  const [walletLookupPDA] = deriveWalletLookupPDA(signer);

  return await program.methods
    .registerDid(username)
    .accounts({
      signer: signer,
      didProfile: didProfilePDA,
      walletLookup: walletLookupPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Build the increment_attestation_count instruction
 * @param {Program} program - Anchor program
 * @param {PublicKey} signer - Wallet public key
 * @param {PublicKey} didProfilePDA - DidProfile PDA address
 * @returns {Promise<import('@solana/web3.js').TransactionInstruction>}
 */
export async function buildIncrementAttestationInstruction(program, signer, didProfilePDA) {
  return await program.methods
    .incrementAttestationCount()
    .accounts({
      signer: signer,
      didProfile: didProfilePDA,
    })
    .instruction();
}

/**
 * Resolve a DID string or username to a DidProfile
 * @param {Program} program - Anchor program
 * @param {string} input - Username or "did:anft:<pda_address>"
 * @returns {Promise<Object|null>} DidProfile data or null
 */
export async function resolveDID(program, input) {
  try {
    console.log('🔍 Resolving DID:', input);

    let profilePDA;

    if (input.startsWith('did:anft:')) {
      // Extract PDA address from DID string
      const pdaAddressStr = input.replace('did:anft:', '');
      try {
        profilePDA = new PublicKey(pdaAddressStr);
      } catch {
        console.error('❌ Invalid DID address');
        return null;
      }
    } else {
      // Treat as username — derive PDA
      [profilePDA] = deriveDidProfilePDA(input);
    }

    // Verify account is owned by ANFT program
    const accountInfo = await program.provider.connection.getAccountInfo(profilePDA);
    if (!accountInfo) {
      console.log('ℹ️ DID not found');
      return null;
    }
    if (!accountInfo.owner.equals(ANFT_PROGRAM_ID)) {
      console.warn('⚠️ Account not owned by ANFT program — invalid DID');
      return null;
    }

    const profile = await program.account.didProfile.fetch(profilePDA);

    console.log('✅ DID resolved:', profile.did);

    return {
      did: profile.did,
      username: profile.username,
      pdaAddress: profile.pdaAddress.toBase58(),
      currentWallet: profile.currentWallet.toBase58(),
      originalWallet: profile.originalWallet.toBase58(),
      createdAt: profile.createdAt.toNumber(),
      attestationCount: profile.attestationCount.toNumber(),
      bump: profile.bump,
    };
  } catch (error) {
    console.error('❌ Error resolving DID:', error);
    return null;
  }
}

/**
 * Validate a username client-side before submitting
 * @param {string} username
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUsername(username) {
  if (!username || username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  if (username.length > 32) {
    return { valid: false, error: 'Username must be at most 32 characters' };
  }
  if (!/^[a-z0-9-]+$/.test(username)) {
    return { valid: false, error: 'Username must be lowercase alphanumeric and hyphens only' };
  }
  return { valid: true };
}

/**
 * Format DID for display (abbreviated)
 * @param {string} did - Full DID string
 * @returns {string} Abbreviated DID
 */
export function formatDID(did) {
  if (!did) return '';
  if (!did.startsWith('did:anft:')) return did;
  const addr = did.replace('did:anft:', '');
  if (addr.length <= 16) return did;
  return `did:anft:${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
}

export default {
  ANFT_PROGRAM_ID,
  getProgram,
  deriveDidProfilePDA,
  deriveWalletLookupPDA,
  checkExistingDID,
  buildRegisterDidInstruction,
  buildIncrementAttestationInstruction,
  resolveDID,
  validateUsername,
  formatDID,
};
