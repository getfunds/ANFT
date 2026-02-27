/**
 * API Route: GET /api/attestation/list
 * 
 * Fetches REAL on-chain SAS attestations for a given DID (subject).
 * Queries the Solana blockchain using getProgramAccounts on the SAS program.
 * 
 * Query: ?did=did:anft:<pda_address>
 * Returns: { attestations: [...] }
 */

import { createSolanaRpc, address as toAddress } from '@solana/kit';
import { 
  fetchSchema,
  deserializeAttestationData,
  decodeAttestation,
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS,
} from 'sas-lib';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const SAS_SCHEMA_ADDRESS = process.env.NEXT_PUBLIC_ANFT_SAS_SCHEMA_ID;
const AUTHORITY_PUBKEY = process.env.NEXT_PUBLIC_ANFT_AUTHORITY_PUBKEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { did } = req.query;

    if (!did) {
      return res.status(400).json({ error: 'Missing required query parameter: did' });
    }

    console.log('🔍 Fetching on-chain attestations for DID:', did);

    const rpc = createSolanaRpc(SOLANA_RPC_URL);
    const schemaAddr = toAddress(SAS_SCHEMA_ADDRESS);

    // Fetch schema to deserialize attestation data
    const schema = await fetchSchema(rpc, schemaAddr);
    console.log('📋 Fetched schema from chain');

    // Attestation account layout:
    // [0]    discriminator (1 byte)
    // [1-32] nonce (32 bytes = Address)
    // [33-64] credential (32 bytes = Address)
    // [65-96] schema (32 bytes = Address)
    // Schema starts at offset 65
    
    // Query all attestation accounts for this schema using getProgramAccounts
    const accounts = await rpc.getProgramAccounts(
      toAddress(SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS),
      {
        encoding: 'base64',
        filters: [
          {
            memcmp: {
              offset: 65n,
              bytes: SAS_SCHEMA_ADDRESS,
              encoding: 'base58',
            },
          },
        ],
      }
    ).send();

    console.log(`📦 Found ${accounts.length} total attestations for schema`);

    // Decode and filter attestations by DID (subject is in the data blob)
    const matchingAttestations = [];
    
    for (const acct of accounts) {
      try {
        const pubkey = acct.pubkey;
        const rawData = Buffer.from(acct.account.data[0], 'base64');
        
        const decoded = decodeAttestation({
          address: pubkey,
          data: new Uint8Array(rawData),
          exists: true,
        });
        
        // Deserialize the attestation data blob using the schema
        const attestationData = deserializeAttestationData(schema.data, decoded.data.data);
        
        if (attestationData.creatorDID === did) {
          matchingAttestations.push({
            attestationAddress: pubkey,
            nftName: attestationData.nftName,
            nftDescription: attestationData.nftDescription,
            nftMintAddress: attestationData.nftMintAddress,
            creatorAddress: attestationData.creatorAddress,
            creatorDID: attestationData.creatorDID,
            imageHash: attestationData.imageHash,
            metadataHash: attestationData.metadataHash,
            imageCID: attestationData.imageCID,
            metadataCID: attestationData.metadataCID,
            network: attestationData.network,
            platform: attestationData.platform,
            royaltyBps: Number(attestationData.royaltyBps),
            timestamp: Number(attestationData.timestamp),
            expiry: Number(decoded.data.expiry),
            signer: decoded.data.signer,
          });
        }
      } catch (err) {
        console.warn('Failed to decode attestation:', acct.pubkey, err.message);
      }
    }

    console.log(`✅ Found ${matchingAttestations.length} attestations for DID`);

    return res.status(200).json({
      attestations: matchingAttestations,
      did,
      schema: SAS_SCHEMA_ADDRESS,
      issuer: AUTHORITY_PUBKEY,
    });
  } catch (error) {
    console.error('❌ Error fetching attestations:', error);
    return res.status(500).json({ error: `Failed to fetch attestations: ${error.message}` });
  }
}
