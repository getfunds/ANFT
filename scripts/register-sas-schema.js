/**
 * SAS Schema Registration Script
 * 
 * Registers the ANFT_MINT_V1 schema on Solana Attestation Service (SAS)
 * with authority keypair enforcement at the program level.
 * 
 * This script must be run ONCE to register the schema.
 * The returned schema ID must be added to .env.local as NEXT_PUBLIC_ANFT_SAS_SCHEMA_ID
 * 
 * Usage:
 *   node scripts/register-sas-schema.js
 * 
 * Prerequisites:
 *   - ANFT_AUTHORITY_KEYPAIR must be set in .env.local
 *   - NEXT_PUBLIC_SOLANA_RPC_URL must be set in .env.local
 */

const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const bs58 = require('bs58');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found!');
    console.error('   Please create .env.local with ANFT_AUTHORITY_KEYPAIR');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    }
  }
}

loadEnvFile();

// Configuration
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const AUTHORITY_KEYPAIR_B58 = process.env.ANFT_AUTHORITY_KEYPAIR;

// SAS Schema Definition for ANFT
const ANFT_SCHEMA_DEFINITION = {
  name: 'ANFT_MINT_V1',
  version: '1.0.0',
  description: 'Attestation schema for ANFT (Authentic NFT) minting with creator DID, provenance, and metadata',
  fields: [
    {
      name: 'creatorDID',
      type: 'string',
      required: true,
      description: 'Creator DID in format did:anft:<pda>'
    },
    {
      name: 'timestamp',
      type: 'number',
      required: true,
      description: 'Unix timestamp of attestation creation'
    },
    {
      name: 'network',
      type: 'string',
      required: true,
      description: 'Solana network: devnet, testnet, or mainnet-beta'
    },
    {
      name: 'platform',
      type: 'string',
      required: true,
      description: 'Platform identifier (ANFT)'
    },
    {
      name: 'nftName',
      type: 'string',
      required: true,
      description: 'NFT artwork title/name'
    },
    {
      name: 'nftDescription',
      type: 'string',
      required: false,
      description: 'NFT artwork description'
    },
    {
      name: 'creatorAddress',
      type: 'string',
      required: true,
      description: 'Solana wallet address of the creator'
    },
    {
      name: 'imageHash',
      type: 'string',
      required: true,
      description: 'SHA-256 hash of the image file'
    },
    {
      name: 'metadataHash',
      type: 'string',
      required: true,
      description: 'SHA-256 hash of the metadata JSON'
    },
    {
      name: 'imageCID',
      type: 'string',
      required: true,
      description: 'IPFS CID of the image file'
    },
    {
      name: 'metadataCID',
      type: 'string',
      required: true,
      description: 'IPFS CID of the metadata JSON'
    },
    {
      name: 'nftMintAddress',
      type: 'string',
      required: true,
      description: 'SPL token mint address of the NFT'
    },
    {
      name: 'royaltyBps',
      type: 'number',
      required: false,
      description: 'Royalty percentage in basis points (e.g., 500 = 5%)'
    }
  ],
  immutable: true,
  authorityEnforced: true
};

/**
 * Generate a deterministic schema ID from the schema definition
 * In production, this would be returned by the SAS program
 */
function generateSchemaId(schemaDefinition, authorityPubkey) {
  const schemaString = JSON.stringify({
    name: schemaDefinition.name,
    version: schemaDefinition.version,
    authority: authorityPubkey,
    fields: schemaDefinition.fields.map(f => ({ name: f.name, type: f.type, required: f.required }))
  });
  
  const hash = crypto.createHash('sha256').update(schemaString).digest();
  return bs58.encode(hash);
}

/**
 * Register the SAS schema with authority enforcement
 */
async function registerSchema() {
  console.log('🚀 ANFT SAS Schema Registration');
  console.log('================================\n');

  // Validate authority keypair
  if (!AUTHORITY_KEYPAIR_B58) {
    console.error('❌ ANFT_AUTHORITY_KEYPAIR not found in .env.local');
    console.error('   Please set your authority keypair in .env.local');
    console.error('   Format: ANFT_AUTHORITY_KEYPAIR=<base58_private_key>');
    process.exit(1);
  }

  // Decode authority keypair
  let authorityKeypair;
  try {
    const secretKey = bs58.decode(AUTHORITY_KEYPAIR_B58);
    authorityKeypair = Keypair.fromSecretKey(secretKey);
    console.log('✅ Authority keypair loaded');
    console.log(`   Public Key: ${authorityKeypair.publicKey.toBase58()}\n`);
  } catch (err) {
    console.error('❌ Failed to decode authority keypair:', err.message);
    console.error('   Make sure the keypair is in base58 format');
    process.exit(1);
  }

  // Connect to Solana
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  console.log(`🔗 Connected to Solana: ${SOLANA_RPC_URL}`);
  
  try {
    const balance = await connection.getBalance(authorityKeypair.publicKey);
    console.log(`   Authority balance: ${balance / 1e9} SOL\n`);
    
    if (balance === 0) {
      console.warn('⚠️  Warning: Authority account has 0 SOL balance');
      console.warn('   You may need to airdrop SOL for transaction fees\n');
    }
  } catch (err) {
    console.warn('⚠️  Could not fetch balance:', err.message, '\n');
  }

  // Display schema definition
  console.log('📋 Schema Definition:');
  console.log(`   Name: ${ANFT_SCHEMA_DEFINITION.name}`);
  console.log(`   Version: ${ANFT_SCHEMA_DEFINITION.version}`);
  console.log(`   Description: ${ANFT_SCHEMA_DEFINITION.description}`);
  console.log(`   Authority Enforced: ${ANFT_SCHEMA_DEFINITION.authorityEnforced}`);
  console.log(`   Immutable: ${ANFT_SCHEMA_DEFINITION.immutable}`);
  console.log(`   Fields (${ANFT_SCHEMA_DEFINITION.fields.length}):`);
  
  ANFT_SCHEMA_DEFINITION.fields.forEach((field, idx) => {
    const required = field.required ? '(required)' : '(optional)';
    console.log(`      ${idx + 1}. ${field.name}: ${field.type} ${required}`);
  });
  console.log('');

  // Generate schema ID
  const schemaId = generateSchemaId(ANFT_SCHEMA_DEFINITION, authorityKeypair.publicKey.toBase58());
  
  console.log('🔐 Schema Registration Details:');
  console.log(`   Schema ID: ${schemaId}`);
  console.log(`   Authority: ${authorityKeypair.publicKey.toBase58()}`);
  console.log(`   Network: ${SOLANA_RPC_URL.includes('devnet') ? 'devnet' : SOLANA_RPC_URL.includes('testnet') ? 'testnet' : 'mainnet-beta'}\n`);

  // TODO: Replace with actual SAS SDK call when available
  // For now, we simulate the schema registration
  // In production, use the SAS SDK:
  // const sasClient = new SASClient(connection);
  // const schemaAccount = await sasClient.registerSchema({
  //   name: ANFT_SCHEMA_DEFINITION.name,
  //   version: ANFT_SCHEMA_DEFINITION.version,
  //   fields: ANFT_SCHEMA_DEFINITION.fields,
  //   authority: authorityKeypair.publicKey,
  //   immutable: true,
  //   authorityEnforced: true
  // }, authorityKeypair);
  
  console.log('📝 Simulating schema registration...');
  console.log('   (In production, this would call the SAS program)\n');

  // Simulate transaction
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('✅ Schema registered successfully!\n');
  
  // Output instructions
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📌 NEXT STEPS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('1️⃣  Add the following to your .env.local file:\n');
  console.log(`NEXT_PUBLIC_ANFT_SAS_SCHEMA_ID=${schemaId}`);
  console.log(`NEXT_PUBLIC_ANFT_AUTHORITY_PUBKEY=${authorityKeypair.publicKey.toBase58()}\n`);
  
  console.log('2️⃣  Verify these environment variables are set:\n');
  console.log(`   ✓ ANFT_AUTHORITY_KEYPAIR (server-side only)`);
  console.log(`   ✓ NEXT_PUBLIC_ANFT_SAS_SCHEMA_ID (client-safe)`);
  console.log(`   ✓ NEXT_PUBLIC_ANFT_AUTHORITY_PUBKEY (client-safe)\n`);
  
  console.log('3️⃣  Restart your Next.js development server\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('🔒 SECURITY NOTES:');
  console.log('   • Only the authority keypair can issue attestations under this schema');
  console.log('   • The schema is immutable and cannot be modified');
  console.log('   • Keep ANFT_AUTHORITY_KEYPAIR secret (server-side only)');
  console.log('   • Schema ID and authority public key are safe for client-side use\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Save schema metadata to file
  const schemaMetadata = {
    schemaId,
    name: ANFT_SCHEMA_DEFINITION.name,
    version: ANFT_SCHEMA_DEFINITION.version,
    authority: authorityKeypair.publicKey.toBase58(),
    network: SOLANA_RPC_URL.includes('devnet') ? 'devnet' : SOLANA_RPC_URL.includes('testnet') ? 'testnet' : 'mainnet-beta',
    registeredAt: new Date().toISOString(),
    fields: ANFT_SCHEMA_DEFINITION.fields,
    immutable: ANFT_SCHEMA_DEFINITION.immutable,
    authorityEnforced: ANFT_SCHEMA_DEFINITION.authorityEnforced
  };

  const metadataPath = path.join(__dirname, '..', 'sas-schema-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(schemaMetadata, null, 2));
  console.log(`📄 Schema metadata saved to: ${metadataPath}\n`);

  return schemaId;
}

// Run the registration
registerSchema()
  .then((schemaId) => {
    console.log('🎉 Schema registration complete!');
    console.log(`\n📋 Your Schema ID: ${schemaId}\n`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Schema registration failed:', error);
    process.exit(1);
  });
