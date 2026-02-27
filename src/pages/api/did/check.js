/**
 * API Endpoint: Check for Existing DID (Solana)
 * 
 * Checks if a Solana wallet has a registered DID by querying the
 * WalletLookup PDA on-chain via the anft_did program.
 * 
 * GET /api/did/check?wallet=<base58_pubkey>
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import IDL from '../../../utils/idl/anft_did.json';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_ANFT_PROGRAM_ID || 'ANFTDidProgramID111111111111111111111111111');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { wallet } = req.query;

    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    let walletPubkey;
    try {
      walletPubkey = new PublicKey(wallet);
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const readOnlyProvider = new AnchorProvider(
      connection,
      { publicKey: null, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs },
      { preflightCommitment: 'confirmed' }
    );
    const program = new Program(IDL, PROGRAM_ID, readOnlyProvider);

    // Derive WalletLookup PDA
    const [walletLookupPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('wallet-did'), walletPubkey.toBuffer()],
      PROGRAM_ID
    );

    const lookup = await program.account.walletLookup.fetchNullable(walletLookupPDA);

    if (!lookup) {
      return res.status(200).json({
        exists: false,
        did: null,
        message: 'No DID found for this wallet',
      });
    }

    // Fetch the full DidProfile
    const profile = await program.account.didProfile.fetch(lookup.pdaAddress);

    return res.status(200).json({
      exists: true,
      did: {
        did: profile.did,
        username: profile.username,
        pdaAddress: profile.pdaAddress.toBase58(),
        currentWallet: profile.currentWallet.toBase58(),
        originalWallet: profile.originalWallet.toBase58(),
        createdAt: profile.createdAt.toNumber(),
        attestationCount: profile.attestationCount.toNumber(),
      },
    });
  } catch (error) {
    console.error('❌ DID check error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to check DID',
      exists: false,
    });
  }
}
