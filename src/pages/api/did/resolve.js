/**
 * API Endpoint: Resolve DID (Solana)
 * 
 * Resolves a DID string or username to its on-chain DidProfile.
 * 
 * GET /api/did/resolve?did=did:anft:<pda>&username=<username>
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
    const { did, username } = req.query;

    if (!did && !username) {
      return res.status(400).json({ error: 'DID string or username is required' });
    }

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const readOnlyProvider = new AnchorProvider(
      connection,
      { publicKey: null, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs },
      { preflightCommitment: 'confirmed' }
    );
    const program = new Program(IDL, PROGRAM_ID, readOnlyProvider);

    let profilePDA;

    if (did && did.startsWith('did:anft:')) {
      const pdaAddressStr = did.replace('did:anft:', '');
      try {
        profilePDA = new PublicKey(pdaAddressStr);
      } catch {
        return res.status(400).json({ error: 'Invalid DID address' });
      }
    } else if (username) {
      [profilePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('did'), Buffer.from(username)],
        PROGRAM_ID
      );
    } else {
      return res.status(400).json({ error: 'Provide a valid did:anft: string or username' });
    }

    // Verify account exists and is owned by ANFT program
    const accountInfo = await connection.getAccountInfo(profilePDA);
    if (!accountInfo) {
      return res.status(404).json({ error: 'DID not found' });
    }
    if (!accountInfo.owner.equals(PROGRAM_ID)) {
      return res.status(404).json({ error: 'Account not owned by ANFT program' });
    }

    const profile = await program.account.didProfile.fetch(profilePDA);

    return res.status(200).json({
      success: true,
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
    console.error('❌ DID resolution error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to resolve DID',
    });
  }
}
