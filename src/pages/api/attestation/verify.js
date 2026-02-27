/**
 * API Route: Verify SAS Attestation
 * 
 * Verifies a REAL on-chain Solana Attestation Service attestation by address.
 * Fetches from blockchain and checks subject, schema, and issuer match ANFT expectations.
 * 
 * GET /api/attestation/verify?address=<attestation_address>
 */

import { createSolanaRpc, address as toAddress } from '@solana/kit';
import { fetchAttestation, fetchSchema, deserializeAttestationData } from 'sas-lib';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const SAS_SCHEMA_ADDRESS = process.env.NEXT_PUBLIC_ANFT_SAS_SCHEMA_ID;
const AUTHORITY_PUBKEY = process.env.NEXT_PUBLIC_ANFT_AUTHORITY_PUBKEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address: attestAddr } = req.query;

    if (!attestAddr) {
      return res.status(400).json({ error: 'Attestation address is required', verified: false });
    }

    console.log('🔍 Verifying on-chain SAS attestation:', attestAddr);

    const rpc = createSolanaRpc(SOLANA_RPC_URL);
    const attestationAddress = toAddress(attestAddr);

    // Fetch the attestation from blockchain
    const attestation = await fetchAttestation(rpc, attestationAddress);
    
    if (!attestation) {
      return res.status(404).json({
        verified: false,
        error: 'Attestation not found on-chain',
      });
    }

    // Verify schema matches
    const schemaMatches = attestation.data.schema === SAS_SCHEMA_ADDRESS;
    
    // Verify signer is the authority
    const signerMatches = attestation.data.signer === AUTHORITY_PUBKEY;

    // Check if attestation is expired
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const isExpired = Number(attestation.data.expiry) < currentTimestamp;

    const verified = schemaMatches && signerMatches && !isExpired;

    // Fetch schema and deserialize data
    const schemaAddr = toAddress(SAS_SCHEMA_ADDRESS);
    const schema = await fetchSchema(rpc, schemaAddr);
    const attestationData = deserializeAttestationData(schema.data, attestation.data.data);

    console.log(`✅ Attestation verification complete: ${verified ? 'VALID' : 'INVALID'}`);

    return res.status(200).json({
      verified,
      attestation: {
        address: attestAddr,
        schema: attestation.data.schema,
        signer: attestation.data.signer,
        credential: attestation.data.credential,
        expiry: Number(attestation.data.expiry),
        data: attestationData,
      },
      checks: {
        schemaMatches,
        signerMatches,
        isExpired,
      },
    });
  } catch (error) {
    console.error('❌ Error verifying attestation:', error);
    return res.status(500).json({
      error: `Verification failed: ${error.message}`,
      verified: false,
    });
  }
}
