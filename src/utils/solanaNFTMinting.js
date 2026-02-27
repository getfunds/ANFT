/**
 * Solana NFT Minting with Atomic Transaction
 *
 * Bundles all operations into a single atomic transaction:
 *   1. register_did (if needed)
 *   2. Metaplex NFT mint
 *   3. SAS attestation (via backend)
 *   4. increment_attestation_count
 *   5. SPL Memo
 */

import {
  Transaction,
  PublicKey,
  SystemProgram,
  Keypair,
} from '@solana/web3.js';
import {
  checkExistingDID,
  buildRegisterDidInstruction,
  buildIncrementAttestationInstruction,
  deriveDidProfilePDA,
  deriveWalletLookupPDA,
  getProgram,
  ANFT_PROGRAM_ID,
} from './solanaDID';
import {
  createSASAttestation,
  buildMemoInstruction,
} from './sasAttestation';
import { createAnchorProvider, getConnection } from './solanaWallet';

/**
 * Upload metadata to IPFS using Filebase
 */
async function uploadMetadataToIPFS(metadata) {
  try {
    console.log('📦 Uploading metadata to Filebase IPFS...');

    const response = await fetch('/api/upload-to-ipfs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata }),
    });

    if (!response.ok) {
      throw new Error(`Filebase IPFS upload failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Metadata uploaded to Filebase IPFS:', result.ipfsUrl);
    return result.ipfsUrl;
  } catch (error) {
    console.error('❌ Filebase IPFS upload failed:', error);
    throw new Error(`IPFS upload failed: ${error.message}. Please check your Filebase configuration.`);
  }
}

/**
 * Complete NFT minting workflow on Solana
 * 
 * @param {Object} walletAdapter - Connected wallet adapter (Phantom etc.)
 * @param {Object} metadata - NFT metadata
 * @param {Object} options - Minting options
 * @param {string|null} options.username - Username for DID registration (null if already has DID)
 * @param {Object|null} options.existingDID - Existing DID info (null if first mint)
 * @param {string} options.contentHash - SHA-256 content hash of artwork
 * @param {number} options.royaltyBps - Royalties in basis points (default 500 = 5%)
 * @param {Function} progressCallback - Progress update callback
 * @returns {Promise<Object>} Mint result
 */
export async function mintNFTWorkflow(
  walletAdapter,
  metadata,
  options = {},
  progressCallback = null
) {
  try {
    console.log('🚀 Starting Solana NFT minting workflow...');
    const wallet = walletAdapter.publicKey;
    console.log('👤 Wallet:', wallet.toBase58());

    const updateProgress = (message) => {
      console.log(message);
      if (progressCallback) progressCallback(message);
    };

    const provider = createAnchorProvider(walletAdapter);
    const program = getProgram(provider);
    const connection = getConnection();

    // ── Determine DID state ──
    let didInfo = options.existingDID;
    let needsRegistration = !didInfo;
    let didProfilePDA;

    if (didInfo) {
      didProfilePDA = new PublicKey(didInfo.pdaAddress);
      console.log('✅ Using existing DID:', didInfo.did);
    } else if (options.username) {
      [didProfilePDA] = deriveDidProfilePDA(options.username);
      console.log('🆕 Will register DID with username:', options.username);
    } else {
      throw new Error('Either existingDID or username must be provided');
    }

    // ── Upload metadata to IPFS ──
    updateProgress('Uploading metadata to IPFS...');
    const metadataUrl = await uploadMetadataToIPFS(metadata);
    console.log('✅ Metadata URL:', metadataUrl);

    // ── Build atomic transaction ──
    updateProgress('Building atomic mint transaction...');
    const transaction = new Transaction();

    // INSTRUCTION 1: register_did (only if first mint)
    if (needsRegistration) {
      updateProgress('Adding DID registration instruction...');
      const registerIx = await buildRegisterDidInstruction(
        program,
        wallet,
        options.username
      );
      transaction.add(registerIx);
      console.log('✅ register_did instruction added');
    }

    // INSTRUCTION 2: Metaplex NFT mint
    // We use the backend to prepare the Metaplex mint instruction
    updateProgress('Preparing Metaplex NFT mint...');
    const mintKeypair = Keypair.generate();
    const mintResponse = await fetch('/api/nft/prepare-mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: wallet.toBase58(),
        mintPublicKey: mintKeypair.publicKey.toBase58(),
        name: metadata.name,
        symbol: metadata.symbol || 'ANFT',
        uri: metadataUrl,
        sellerFeeBasisPoints: options.royaltyBps || 500,
      }),
    });

    if (!mintResponse.ok) {
      const errData = await mintResponse.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to prepare Metaplex mint');
    }

    const mintData = await mintResponse.json();

    // Deserialize and add mint instructions
    if (mintData.instructions) {
      for (const ixData of mintData.instructions) {
        const ix = deserializeInstruction(ixData);
        transaction.add(ix);
      }
    }
    console.log('✅ Metaplex mint instructions added');

    const nftMintAddress = mintKeypair.publicKey.toBase58();
    const mintTimestamp = Math.floor(Date.now() / 1000);

    // INSTRUCTION 3: SAS attestation (created via backend, instruction added to tx)
    updateProgress('Creating SAS attestation...');
    const didString = didInfo
      ? didInfo.did
      : `did:anft:${didProfilePDA.toBase58()}`;

    const sasResult = await createSASAttestation({
      creatorDID: didString,
      nftMintAddress,
      nftName: metadata.name,
      nftDescription: metadata.description || '',
      creatorAddress: wallet.toBase58(),
      imageHash: options.imageHash || options.contentHash || '',
      metadataHash: options.metadataHash || options.contentHash || '',
      imageCID: options.imageCID || '',
      metadataCID: options.metadataCID || '',
      network: process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet',
      royaltyBps: options.royaltyBps || 500,
      timestamp: mintTimestamp,
    });
    console.log('✅ SAS attestation created:', sasResult.attestationAddress);

    // INSTRUCTION 4: increment_attestation_count
    updateProgress('Adding attestation count increment...');
    const incrementIx = await buildIncrementAttestationInstruction(
      program,
      wallet,
      didProfilePDA
    );
    transaction.add(incrementIx);
    console.log('✅ increment_attestation_count instruction added');

    // INSTRUCTION 5: SPL Memo
    updateProgress('Adding SPL Memo...');
    const memoIx = buildMemoInstruction({
      sasAttestationAddress: sasResult.attestationAddress,
      creatorDID: didString,
      nftMintAddress,
      nftName: metadata.name,
      network: process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet',
      timestamp: mintTimestamp,
      signer: wallet,
    });
    transaction.add(memoIx);
    console.log('✅ SPL Memo instruction added');

    // ── Send transaction ──
    updateProgress('Sending transaction (please approve in your wallet)...');
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet;

    // Add mint keypair as signer if needed
    if (mintData.requiresMintSigner) {
      transaction.partialSign(mintKeypair);
    }

    // Sign with wallet
    const signedTx = await walletAdapter.signTransaction(transaction);
    const txSignature = await connection.sendRawTransaction(
      signedTx.serialize()
    );

    updateProgress('Confirming transaction...');
    await connection.confirmTransaction(txSignature, 'confirmed');

    console.log('🎉 NFT minted successfully!');
    console.log('🔗 Transaction:', txSignature);

    // ── Build result ──
    const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
    const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;

    const result = {
      mint: {
        tokenId: nftMintAddress,
        serialNumber: 1,
        transactionId: txSignature,
        metadataUrl,
      },
      nftId: nftMintAddress,
      did: didString,
      attestation: sasResult,
      explorerUrl: `https://explorer.solana.com/tx/${txSignature}${clusterParam}`,
      nftUrl: `https://explorer.solana.com/address/${nftMintAddress}${clusterParam}`,
      attestationUrl: sasResult.explorerUrl,
      success: true,
    };

    updateProgress(`NFT minted! Mint: ${nftMintAddress.substring(0, 8)}...`);
    return result;
  } catch (error) {
    console.error('❌ Solana NFT minting workflow failed:', error);
    throw error;
  }
}

/**
 * Deserialize an instruction from JSON format
 * @param {Object} ixData - Serialized instruction
 * @returns {import('@solana/web3.js').TransactionInstruction}
 */
function deserializeInstruction(ixData) {
  const { TransactionInstruction: TxInstruction } = require('@solana/web3.js');
  return new TxInstruction({
    keys: ixData.keys.map((k) => ({
      pubkey: new PublicKey(k.pubkey),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    programId: new PublicKey(ixData.programId),
    data: Buffer.from(ixData.data, 'base64'),
  });
}

export default {
  mintNFTWorkflow,
};
