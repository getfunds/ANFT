/**
 * Solana Attestation Service (SAS) Integration
 *
 * Each NFT mint produces one immutable SAS attestation
 * with the artist's DID as the subject.
 *
 * Schema: ANFT_MINT_V1
 * Fields: creatorDID, timestamp, network, platform, nftName, nftDescription,
 *         creatorAddress, imageHash, metadataHash, imageCID, metadataCID,
 *         nftMintAddress, royaltyBps
 */

import { PublicKey, TransactionInstruction } from '@solana/web3.js';

// SAS Schema ID — set after one-time schema registration
export const ANFT_SAS_SCHEMA_ID = process.env.NEXT_PUBLIC_ANFT_SAS_SCHEMA_ID || '';

// ANFT authority public key (the schema authority that signs attestations)
export const ANFT_AUTHORITY_PUBKEY = process.env.NEXT_PUBLIC_ANFT_AUTHORITY_PUBKEY || '';

// SPL Memo program ID
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * Build the SAS attestation data payload
 * @param {Object} params
 * @param {string} params.creatorDID - Full DID string "did:anft:<pda>"
 * @param {string} params.nftMintAddress - SPL token mint address
 * @param {string} params.nftName - Artwork title/name
 * @param {string} params.nftDescription - Artwork description (optional)
 * @param {string} params.creatorAddress - Creator's Solana wallet address
 * @param {string} params.imageHash - SHA-256 hash of image file
 * @param {string} params.metadataHash - SHA-256 hash of metadata JSON
 * @param {string} params.imageCID - IPFS CID of image file
 * @param {string} params.metadataCID - IPFS CID of metadata JSON
 * @param {string} params.network - Solana network (devnet, testnet, mainnet-beta)
 * @param {number} params.royaltyBps - Royalties in basis points (optional, default 500)
 * @param {number} params.timestamp - Unix timestamp (optional, defaults to now)
 * @returns {Object} Attestation data payload
 */
export function buildAttestationPayload({
  creatorDID,
  nftMintAddress,
  nftName,
  nftDescription = '',
  creatorAddress,
  imageHash,
  metadataHash,
  imageCID,
  metadataCID,
  network,
  royaltyBps = 500,
  timestamp,
}) {
  const payload = {
    creatorDID,
    timestamp: timestamp || Math.floor(Date.now() / 1000),
    network: network || process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet',
    platform: 'ANFT',
    nftName,
    nftDescription,
    creatorAddress,
    imageHash,
    metadataHash,
    imageCID,
    metadataCID,
    nftMintAddress,
    royaltyBps,
  };

  console.log('📝 SAS attestation payload built:', {
    creatorDID: payload.creatorDID,
    nftMintAddress: payload.nftMintAddress,
    nftName: payload.nftName,
    creatorAddress: payload.creatorAddress,
    network: payload.network,
    platform: payload.platform,
    imageHash: payload.imageHash.substring(0, 16) + '...',
    metadataHash: payload.metadataHash.substring(0, 16) + '...',
    imageCID: payload.imageCID,
    metadataCID: payload.metadataCID,
    royaltyBps: payload.royaltyBps,
    timestamp: payload.timestamp,
  });

  return payload;
}

/**
 * Build the SPL Memo instruction for the mint transaction.
 * This makes the transaction human-readable on any Solana explorer.
 * 
 * @param {Object} params
 * @param {string} params.sasAttestationAddress - SAS attestation account address
 * @param {string} params.creatorDID - Full DID string
 * @param {string} params.nftMintAddress - SPL token mint address
 * @param {string} params.nftName - Artwork title
 * @param {string} params.network - Solana network
 * @param {number} params.timestamp - Unix timestamp
 * @param {PublicKey} params.signer - Signer public key
 * @returns {TransactionInstruction} SPL Memo instruction
 */
export function buildMemoInstruction({
  sasAttestationAddress,
  creatorDID,
  nftMintAddress,
  nftName,
  network,
  timestamp,
  signer,
}) {
  const memoData = JSON.stringify({
    sas_attestation: sasAttestationAddress,
    creator_did: creatorDID,
    nft_mint: nftMintAddress,
    nft_name: nftName,
    network,
    platform: 'ANFT',
    timestamp,
  });

  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoData, 'utf-8'),
  });
}

/**
 * Create a SAS attestation via the backend API.
 * The backend holds the authority keypair and signs the attestation.
 * 
 * @param {Object} params
 * @param {string} params.creatorDID - Full DID string
 * @param {string} params.nftMintAddress - SPL token mint address
 * @param {string} params.nftName - Artwork title/name
 * @param {string} params.nftDescription - Artwork description (optional)
 * @param {string} params.creatorAddress - Creator's Solana wallet address
 * @param {string} params.imageHash - SHA-256 hash of image file
 * @param {string} params.metadataHash - SHA-256 hash of metadata JSON
 * @param {string} params.imageCID - IPFS CID of image file
 * @param {string} params.metadataCID - IPFS CID of metadata JSON
 * @param {string} params.network - Solana network (devnet, testnet, mainnet-beta)
 * @param {number} params.royaltyBps - Royalties in basis points (optional)
 * @param {number} params.timestamp - Unix timestamp (optional)
 * @returns {Promise<Object>} { attestationAddress, attestationData }
 */
export async function createSASAttestation({
  creatorDID,
  nftMintAddress,
  nftName,
  nftDescription = '',
  creatorAddress,
  imageHash,
  metadataHash,
  imageCID,
  metadataCID,
  network,
  royaltyBps = 500,
  timestamp,
}) {
  try {
    console.log('🔐 Creating SAS attestation...');
    console.log('👤 Creator DID:', creatorDID);
    console.log('🎨 NFT Mint:', nftMintAddress);
    console.log('🌐 Network:', network);

    const payload = buildAttestationPayload({
      creatorDID,
      nftMintAddress,
      nftName,
      nftDescription,
      creatorAddress,
      imageHash,
      metadataHash,
      imageCID,
      metadataCID,
      network,
      royaltyBps,
      timestamp,
    });

    // Call backend API which holds the authority keypair
    const response = await fetch('/api/attestation/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `SAS attestation failed: ${response.status}`);
    }

    const result = await response.json();

    console.log('✅ SAS attestation created');
    console.log('📋 Attestation address:', result.attestationAddress);

    return {
      attestationAddress: result.attestationAddress,
      attestationData: payload,
      explorerUrl: `https://attest.solana.com/attestation/${result.attestationAddress}`,
    };
  } catch (error) {
    console.error('❌ SAS attestation creation failed:', error);
    throw new Error(`Failed to create SAS attestation: ${error.message}`);
  }
}

/**
 * Fetch attestations for a DID from SAS, filtered by subject + schema + issuer.
 * 
 * @param {string} did - Full DID string (subject)
 * @returns {Promise<Array>} Array of attestation records
 */
export async function fetchAttestationsForDID(did) {
  try {
    console.log('🔍 Fetching SAS attestations for DID:', did);

    const response = await fetch(
      `/api/attestation/list?did=${encodeURIComponent(did)}`
    );

    if (!response.ok) {
      console.warn('⚠️ Failed to fetch attestations:', response.status);
      return [];
    }

    const data = await response.json();
    const attestations = data.attestations || [];

    console.log(`✅ Found ${attestations.length} attestations for DID`);
    return attestations;
  } catch (error) {
    console.error('❌ Error fetching attestations:', error);
    return [];
  }
}

/**
 * Verify a single SAS attestation by address.
 * Checks subject, schema, and issuer.
 * 
 * @param {string} attestationAddress - SAS attestation account address
 * @returns {Promise<Object|null>} Verified attestation data or null
 */
export async function verifySASAttestation(attestationAddress) {
  try {
    console.log('🔍 Verifying SAS attestation:', attestationAddress);

    const response = await fetch(
      `/api/attestation/verify?address=${encodeURIComponent(attestationAddress)}`
    );

    if (!response.ok) {
      console.warn('⚠️ Attestation verification failed');
      return null;
    }

    const data = await response.json();

    if (!data.verified) {
      console.warn('⚠️ Attestation did not pass verification');
      return null;
    }

    console.log('✅ Attestation verified');
    return data.attestation;
  } catch (error) {
    console.error('❌ Error verifying attestation:', error);
    return null;
  }
}

/**
 * Get attestation explorer URL
 * @param {string} attestationAddress - SAS attestation account address
 * @returns {string} Explorer URL
 */
export function getAttestationExplorerUrl(attestationAddress) {
  return `https://attest.solana.com/attestation/${attestationAddress}`;
}

/**
 * Get Solana explorer URL for a mint address
 * @param {string} mintAddress - SPL token mint address
 * @param {string} cluster - 'mainnet-beta' or 'devnet'
 * @returns {string} Explorer URL
 */
export function getSolanaExplorerUrl(mintAddress, cluster = 'mainnet-beta') {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://explorer.solana.com/address/${mintAddress}${clusterParam}`;
}

export default {
  ANFT_SAS_SCHEMA_ID,
  ANFT_AUTHORITY_PUBKEY,
  MEMO_PROGRAM_ID,
  buildAttestationPayload,
  buildMemoInstruction,
  createSASAttestation,
  fetchAttestationsForDID,
  verifySASAttestation,
  getAttestationExplorerUrl,
  getSolanaExplorerUrl,
};
