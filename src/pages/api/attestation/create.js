/**
 * API Route: POST /api/attestation/create
 * 
 * Creates a REAL on-chain SAS attestation for an NFT mint.
 * The authority keypair is held server-side and never exposed to the client.
 * 
 * Body: { creatorDID, nftMintAddress, nftName, nftDescription, creatorAddress,
 *         imageHash, metadataHash, imageCID, metadataCID, network, royaltyBps, timestamp }
 * Returns: { attestationAddress, success }
 */

import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createKeyPairSignerFromBytes,
  address as toAddress,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
} from '@solana/kit';
import { 
  getCreateAttestationInstruction,
  deriveAttestationPda,
  fetchSchema,
  serializeAttestationData,
} from 'sas-lib';
import bs58 from 'bs58';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const SOLANA_WS_URL = SOLANA_RPC_URL.replace('https://', 'wss://').replace('http://', 'ws://');
const AUTHORITY_KEYPAIR_B58 = process.env.ANFT_AUTHORITY_KEYPAIR;
const SAS_SCHEMA_ADDRESS = process.env.NEXT_PUBLIC_ANFT_SAS_SCHEMA_ID;
const AUTHORITY_PUBKEY = process.env.NEXT_PUBLIC_ANFT_AUTHORITY_PUBKEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
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
      platform
    } = req.body;

    // Validate required fields
    if (!creatorDID || !nftMintAddress || !nftName || !creatorAddress ||
        !imageHash || !metadataHash || !imageCID || !metadataCID || !network) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['creatorDID', 'nftMintAddress', 'nftName', 'creatorAddress',
                   'imageHash', 'metadataHash', 'imageCID', 'metadataCID', 'network']
      });
    }

    if (!AUTHORITY_KEYPAIR_B58) {
      console.error('ANFT_AUTHORITY_KEYPAIR not configured');
      return res.status(500).json({ error: 'Server configuration error: authority keypair not set' });
    }

    if (!SAS_SCHEMA_ADDRESS) {
      console.error('ANFT_SAS_SCHEMA_ID not configured');
      return res.status(500).json({ error: 'Server configuration error: SAS schema ID not set' });
    }

    console.log('📝 Creating on-chain SAS attestation...');
    console.log('   Creator DID:', creatorDID);
    console.log('   NFT Mint:', nftMintAddress);
    console.log('   NFT Name:', nftName);
    console.log('   Network:', network);

    // Decode authority keypair for signing
    let authoritySigner;
    try {
      const secretKey = bs58.decode(AUTHORITY_KEYPAIR_B58);
      authoritySigner = await createKeyPairSignerFromBytes(secretKey);
    } catch (err) {
      console.error('Failed to decode authority keypair:', err);
      return res.status(500).json({ error: 'Invalid authority keypair configuration' });
    }

    const rpc = createSolanaRpc(SOLANA_RPC_URL);
    const rpcSubscriptions = createSolanaRpcSubscriptions(SOLANA_WS_URL);

    // Fetch the on-chain schema to get its structure
    const schemaAddr = toAddress(SAS_SCHEMA_ADDRESS);
    const schema = await fetchSchema(rpc, schemaAddr);
    console.log('📋 Fetched SAS schema from chain');

    // Build attestation data object matching schema fields
    const attestationDataObj = {
      creatorDID,
      timestamp: BigInt(timestamp || Math.floor(Date.now() / 1000)),
      network,
      platform: platform || 'ANFT',
      nftName,
      nftDescription: nftDescription || '',
      creatorAddress,
      imageHash,
      metadataHash,
      imageCID,
      metadataCID,
      nftMintAddress,
      royaltyBps: BigInt(royaltyBps || 500),
    };

    // Serialize attestation data using the schema
    const serializedData = serializeAttestationData(schema.data, attestationDataObj);
    console.log('🔐 Serialized attestation data:', serializedData.length, 'bytes');

    // Use NFT mint address as nonce for deterministic PDA
    const nonce = toAddress(nftMintAddress);
    
    // Derive attestation PDA
    const [attestationPda] = await deriveAttestationPda({
      credential: schema.data.credential,
      schema: schemaAddr,
      nonce,
    });
    console.log('📍 Attestation PDA:', attestationPda);

    // Attestation expiry: 10 years from now (essentially permanent)
    const expiryTimestamp = Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60);

    // Build create attestation instruction
    const createAttestationIx = getCreateAttestationInstruction({
      payer: authoritySigner,
      authority: authoritySigner,
      credential: schema.data.credential,
      schema: schemaAddr,
      attestation: attestationPda,
      nonce,
      data: serializedData,
      expiry: BigInt(expiryTimestamp),
    });

    // Build, sign, and send transaction using @solana/kit v2 pattern
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      tx => setTransactionMessageFeePayer(authoritySigner.address, tx),
      tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      tx => appendTransactionMessageInstruction(createAttestationIx, tx),
    );

    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
    
    const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
    await sendAndConfirm(signedTransaction, { commitment: 'confirmed' });
    
    const signature = getSignatureFromTransaction(signedTransaction);

    console.log('✅ On-chain SAS attestation created!');
    console.log('   Attestation PDA:', attestationPda);
    console.log('   Transaction:', signature);

    return res.status(200).json({
      attestationAddress: attestationPda,
      schema: SAS_SCHEMA_ADDRESS,
      issuer: AUTHORITY_PUBKEY,
      subject: creatorDID,
      network,
      signature,
      success: true,
    });
  } catch (error) {
    console.error('❌ SAS attestation creation failed:', error);
    return res.status(500).json({ error: `Attestation creation failed: ${error.message}` });
  }
}
