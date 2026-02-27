/**
 * API Route: POST /api/nft/prepare-mint
 * 
 * Prepares Metaplex NFT mint instructions for client-side signing.
 * Returns serialized instructions that the client adds to the atomic transaction.
 * 
 * Body: { wallet, mintPublicKey, name, symbol, uri, sellerFeeBasisPoints }
 * Returns: { instructions: [...], requiresMintSigner: true }
 */

import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getCreateMetadataAccountV3InstructionDataSerializer } from '@metaplex-foundation/mpl-token-metadata';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

function serializeInstruction(ix) {
  return {
    programId: ix.programId.toBase58(),
    keys: ix.keys.map(k => ({
      pubkey: k.pubkey.toBase58(),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: Buffer.from(ix.data).toString('base64'),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { wallet, mintPublicKey, name, symbol, uri, sellerFeeBasisPoints } = req.body;

    if (!wallet || !mintPublicKey || !name || !uri) {
      return res.status(400).json({ error: 'Missing required fields: wallet, mintPublicKey, name, uri' });
    }

    console.log('🎨 Preparing Metaplex NFT mint instructions...');
    console.log('   Wallet:', wallet);
    console.log('   Mint:', mintPublicKey);
    console.log('   Name:', name);

    const walletPubkey = new PublicKey(wallet);
    const mintPubkey = new PublicKey(mintPublicKey);
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    const instructions = [];

    // 1. Create mint account
    const mintRent = await connection.getMinimumBalanceForRentExemption(82); // MintLayout.span
    instructions.push(
      SystemProgram.createAccount({
        fromPubkey: walletPubkey,
        newAccountPubkey: mintPubkey,
        space: 82,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID,
      })
    );

    // 2. Initialize mint (0 decimals for NFT)
    const initMintData = Buffer.alloc(67);
    initMintData.writeUInt8(0, 0); // InitializeMint instruction
    initMintData.writeUInt8(0, 1); // decimals = 0
    walletPubkey.toBuffer().copy(initMintData, 2); // mint authority
    initMintData.writeUInt8(1, 34); // has freeze authority
    walletPubkey.toBuffer().copy(initMintData, 35); // freeze authority

    instructions.push(
      new TransactionInstruction({
        keys: [
          { pubkey: mintPubkey, isSigner: false, isWritable: true },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        programId: TOKEN_PROGRAM_ID,
        data: initMintData,
      })
    );

    // 3. Create associated token account
    const [ata] = PublicKey.findProgramAddressSync(
      [walletPubkey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    instructions.push(
      new TransactionInstruction({
        keys: [
          { pubkey: walletPubkey, isSigner: true, isWritable: true },
          { pubkey: ata, isSigner: false, isWritable: true },
          { pubkey: walletPubkey, isSigner: false, isWritable: false },
          { pubkey: mintPubkey, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        data: Buffer.alloc(0),
      })
    );

    // 4. Mint 1 token to ATA
    const mintToData = Buffer.alloc(9);
    mintToData.writeUInt8(7, 0); // MintTo instruction
    mintToData.writeBigUInt64LE(1n, 1); // amount = 1

    instructions.push(
      new TransactionInstruction({
        keys: [
          { pubkey: mintPubkey, isSigner: false, isWritable: true },
          { pubkey: ata, isSigner: false, isWritable: true },
          { pubkey: walletPubkey, isSigner: true, isWritable: false },
        ],
        programId: TOKEN_PROGRAM_ID,
        data: mintToData,
      })
    );

    // 5. Create metadata account (Metaplex Token Metadata)
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    );

    const metadataSerializer = getCreateMetadataAccountV3InstructionDataSerializer();
    const metadataData = metadataSerializer.serialize({
      data: {
        name: name.substring(0, 32),
        symbol: (symbol || 'ANFT').substring(0, 10),
        uri: uri.substring(0, 200),
        sellerFeeBasisPoints: sellerFeeBasisPoints || 500,
        creators: null,
        collection: null,
        uses: null,
      },
      isMutable: true,
      collectionDetails: null,
    });

    instructions.push(
      new TransactionInstruction({
        keys: [
          { pubkey: metadataPDA, isSigner: false, isWritable: true },
          { pubkey: mintPubkey, isSigner: false, isWritable: false },
          { pubkey: walletPubkey, isSigner: true, isWritable: false },
          { pubkey: walletPubkey, isSigner: true, isWritable: true },
          { pubkey: walletPubkey, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        programId: TOKEN_METADATA_PROGRAM_ID,
        data: Buffer.from(metadataData),
      })
    );

    // Serialize all instructions
    const serializedInstructions = instructions.map(serializeInstruction);

    console.log(`✅ Prepared ${serializedInstructions.length} mint instructions`);

    return res.status(200).json({
      instructions: serializedInstructions,
      requiresMintSigner: true,
      mint: mintPublicKey,
      ata: ata.toBase58(),
      metadata: metadataPDA.toBase58(),
    });
  } catch (error) {
    console.error('❌ Error preparing mint instructions:', error);
    return res.status(500).json({ error: `Failed to prepare mint: ${error.message}` });
  }
}
