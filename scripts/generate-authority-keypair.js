/**
 * Generate Authority Keypair Script
 * 
 * Generates a new Solana keypair to be used as the ANFT authority
 * for signing SAS attestations.
 * 
 * This script should be run ONCE to generate the authority keypair.
 * The output should be added to .env.local as ANFT_AUTHORITY_KEYPAIR
 * 
 * Usage:
 *   node scripts/generate-authority-keypair.js
 */

const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

console.log('🔑 Generating ANFT Authority Keypair');
console.log('=====================================\n');

// Generate a new keypair
const keypair = Keypair.generate();

// Encode the secret key in base58
const secretKeyBase58 = bs58.encode(keypair.secretKey);

console.log('✅ Authority keypair generated!\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📌 ADD THESE TO YOUR .env.local FILE:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('# ANFT Authority Keypair (KEEP SECRET - Server-side only)');
console.log(`ANFT_AUTHORITY_KEYPAIR=${secretKeyBase58}\n`);

console.log('# ANFT Authority Public Key (Safe for client-side)');
console.log(`NEXT_PUBLIC_ANFT_AUTHORITY_PUBKEY=${keypair.publicKey.toBase58()}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🔒 SECURITY WARNINGS:');
console.log('   • NEVER commit .env.local to version control');
console.log('   • NEVER expose ANFT_AUTHORITY_KEYPAIR to the client');
console.log('   • Keep the private key secure - it controls attestation authority');
console.log('   • The public key can be safely shared\n');

console.log('📋 Public Key (for reference):');
console.log(`   ${keypair.publicKey.toBase58()}\n`);

console.log('✅ Done! Copy the environment variables above to your .env.local file.\n');
