/**
 * Setup Script: Create SAS Credential and Schema on-chain
 * 
 * This script creates the required Credential and Schema accounts
 * on Solana devnet for the ANFT SAS attestation system.
 * 
 * Run: node scripts/setup-sas-schema.mjs
 */

import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createKeyPairSignerFromBytes,
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
  getCreateCredentialInstruction,
  getCreateSchemaInstruction,
  deriveCredentialPda,
  deriveSchemaPda,
  fetchCredential,
  fetchSchema
} from 'sas-lib';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const SOLANA_WS_URL = SOLANA_RPC_URL.replace('https://', 'wss://').replace('http://', 'ws://');
const AUTHORITY_KEYPAIR_B58 = process.env.ANFT_AUTHORITY_KEYPAIR;

// Schema definition for ANFT NFT attestations
const SCHEMA_NAME = 'ANFT_MINT_V1';
const SCHEMA_VERSION = 1;
const CREDENTIAL_NAME = 'ANFT_AUTHORITY';

// SAS compact layout type bytes (from compactLayoutMapping in sas-lib/utils.js)
// 3 = u64, 12 = string
const FIELD_DEFINITIONS = [
  { name: 'creatorDID',     layoutByte: 12 }, // string
  { name: 'timestamp',      layoutByte: 3 },  // u64
  { name: 'network',        layoutByte: 12 }, // string
  { name: 'platform',       layoutByte: 12 }, // string
  { name: 'nftName',        layoutByte: 12 }, // string
  { name: 'nftDescription', layoutByte: 12 }, // string
  { name: 'creatorAddress', layoutByte: 12 }, // string
  { name: 'imageHash',      layoutByte: 12 }, // string
  { name: 'metadataHash',   layoutByte: 12 }, // string
  { name: 'imageCID',       layoutByte: 12 }, // string
  { name: 'metadataCID',    layoutByte: 12 }, // string
  { name: 'nftMintAddress', layoutByte: 12 }, // string
  { name: 'royaltyBps',     layoutByte: 3 },  // u64
];

// Build layout bytes array (one byte per field)
function buildLayoutBytes() {
  return new Uint8Array(FIELD_DEFINITIONS.map(f => f.layoutByte));
}

// Build fieldNames as "joined vecs" format: [u32_le_len][bytes]...
function buildFieldNamesBytes() {
  const encoder = new TextEncoder();
  const parts = [];
  for (const field of FIELD_DEFINITIONS) {
    const nameBytes = encoder.encode(field.name);
    const lenBuf = new Uint8Array(4);
    new DataView(lenBuf.buffer).setUint32(0, nameBytes.length, true);
    parts.push(lenBuf, nameBytes);
  }
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

async function sendTransaction(rpc, rpcSubscriptions, authoritySigner, instruction) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    tx => setTransactionMessageFeePayer(authoritySigner.address, tx),
    tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    tx => appendTransactionMessageInstruction(instruction, tx),
  );

  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
  
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  await sendAndConfirm(signedTransaction, { commitment: 'confirmed' });
  
  return getSignatureFromTransaction(signedTransaction);
}

async function main() {
  console.log('🚀 Setting up SAS Credential and Schema on-chain...\n');

  if (!AUTHORITY_KEYPAIR_B58) {
    console.error('❌ ANFT_AUTHORITY_KEYPAIR not found in .env.local');
    process.exit(1);
  }

  // Decode authority keypair
  const secretKey = bs58.decode(AUTHORITY_KEYPAIR_B58);
  const authoritySigner = await createKeyPairSignerFromBytes(secretKey);
  const authorityAddress = authoritySigner.address;

  console.log('📋 Authority Address:', authorityAddress);
  console.log('📡 RPC:', SOLANA_RPC_URL);
  console.log('📡 WS:', SOLANA_WS_URL);

  const rpc = createSolanaRpc(SOLANA_RPC_URL);
  const rpcSubscriptions = createSolanaRpcSubscriptions(SOLANA_WS_URL);

  // Check authority balance
  const { value: balance } = await rpc.getBalance(authorityAddress).send();
  console.log('💰 Authority balance:', Number(balance) / 1e9, 'SOL');
  if (balance < 10_000_000n) {
    console.error('❌ Insufficient balance. Need at least 0.01 SOL. Airdrop with:');
    console.error(`   solana airdrop 1 ${authorityAddress} --url devnet`);
    process.exit(1);
  }

  // Step 1: Derive and check Credential PDA
  const [credentialPda] = await deriveCredentialPda({
    authority: authorityAddress,
    name: CREDENTIAL_NAME,
  });

  console.log('\n1️⃣  Credential PDA:', credentialPda);

  let credentialExists = false;
  try {
    const existingCredential = await fetchCredential(rpc, credentialPda);
    if (existingCredential) {
      console.log('   ✅ Credential already exists on-chain');
      credentialExists = true;
    }
  } catch (err) {
    console.log('   ℹ️  Credential does not exist yet, creating...');
  }

  // Step 2: Create Credential if it doesn't exist
  if (!credentialExists) {
    const createCredentialIx = getCreateCredentialInstruction({
      payer: authoritySigner,
      credential: credentialPda,
      authority: authoritySigner,
      name: CREDENTIAL_NAME,
      signers: [authorityAddress],
    });

    const sig = await sendTransaction(rpc, rpcSubscriptions, authoritySigner, createCredentialIx);
    console.log('   ✅ Credential created! Tx:', sig);
  }

  // Step 3: Derive and check Schema PDA
  const [schemaPda] = await deriveSchemaPda({
    credential: credentialPda,
    name: SCHEMA_NAME,
    version: SCHEMA_VERSION,
  });

  console.log('\n2️⃣  Schema PDA:', schemaPda);

  let schemaExists = false;
  try {
    const existingSchema = await fetchSchema(rpc, schemaPda);
    if (existingSchema) {
      console.log('   ✅ Schema already exists on-chain');
      schemaExists = true;
    }
  } catch (err) {
    console.log('   ℹ️  Schema does not exist yet, creating...');
  }

  // Step 4: Create Schema if it doesn't exist
  if (!schemaExists) {
    const layoutBytes = buildLayoutBytes();
    const fieldNamesBytes = buildFieldNamesBytes();

    console.log('   Layout bytes:', Array.from(layoutBytes));
    console.log('   Field names count:', FIELD_DEFINITIONS.length);

    const createSchemaIx = getCreateSchemaInstruction({
      payer: authoritySigner,
      authority: authoritySigner,
      credential: credentialPda,
      schema: schemaPda,
      name: SCHEMA_NAME,
      description: 'ANFT NFT Mint Attestation Schema',
      layout: layoutBytes,
      fieldNames: FIELD_DEFINITIONS.map(f => f.name),
    });

    const sig = await sendTransaction(rpc, rpcSubscriptions, authoritySigner, createSchemaIx);
    console.log('   ✅ Schema created! Tx:', sig);
  }

  // Step 5: Display final configuration
  console.log('\n✅ Setup Complete!\n');
  console.log('📝 Update your .env.local with:\n');
  console.log(`NEXT_PUBLIC_ANFT_SAS_SCHEMA_ID=${schemaPda}`);
  console.log(`# Credential PDA: ${credentialPda}`);
  console.log(`# Authority: ${authorityAddress}\n`);
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err);
  process.exit(1);
});
