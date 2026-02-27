/**
 * NFT utility functions for fetching and processing NFT data (Solana)
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';

/**
 * Get all NFTs owned by a wallet from Solana
 */
export async function getAccountNFTs(walletAddress) {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const walletPubkey = new PublicKey(walletAddress);

    // Fetch all token accounts for this wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPubkey, {
      programId: TOKEN_PROGRAM_ID,
    });

    // Filter for NFTs (amount = 1, decimals = 0)
    const nfts = tokenAccounts.value
      .filter((ta) => {
        const info = ta.account.data.parsed.info;
        return (
          info.tokenAmount.decimals === 0 &&
          info.tokenAmount.uiAmount === 1
        );
      })
      .map((ta) => {
        const info = ta.account.data.parsed.info;
        return {
          mint: info.mint,
          owner: walletAddress,
          token_account: ta.pubkey.toBase58(),
        };
      });

    return nfts;
  } catch (error) {
    console.error('❌ Error getting account NFTs:', error);
    throw error;
  }
}

/**
 * Get NFT metadata from IPFS URL
 */
export async function getNFTMetadata(metadataUrl) {
  try {
    if (!metadataUrl || typeof metadataUrl !== 'string') {
      return null;
    }
    
    // Handle different IPFS URL formats
    let url = metadataUrl;
    if (metadataUrl.startsWith('ipfs://')) {
      url = metadataUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    } else if (metadataUrl.includes('ipfs/Qm') || metadataUrl.includes('ipfs/bafy')) {
      // Already in gateway format
      url = metadataUrl;
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch metadata from ${url}`);
      return null;
    }
    
    const metadata = await response.json();
    return metadata;
  } catch (error) {
    console.warn('Failed to fetch NFT metadata:', error);
    return null;
  }
}

/**
 * Process raw NFT data from Solana to user-friendly format
 * Uses Metaplex Token Metadata for on-chain metadata URI
 */
export async function processNFTData(rawNfts, walletAddress) {
  const processedNfts = [];

  for (const nft of rawNfts) {
    try {
      let metadataUrl = null;
      let metadata = null;

      // Fetch on-chain metadata URI from Metaplex Token Metadata PDA
      try {
        const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
        const mintPubkey = new PublicKey(nft.mint);
        const [metadataPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
          TOKEN_METADATA_PROGRAM_ID
        );

        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        const accountInfo = await connection.getAccountInfo(metadataPDA);

        if (accountInfo && accountInfo.data) {
          // Parse Metaplex metadata to extract URI (simplified parsing)
          const data = accountInfo.data;
          // Skip discriminator(1) + key(1) + update_authority(32) + mint(32) = 66 bytes
          // Then name: 4 bytes length + up to 32 bytes
          // Then symbol: 4 bytes length + up to 10 bytes
          // Then uri: 4 bytes length + up to 200 bytes
          let offset = 1 + 32 + 32; // key + update_authority + mint
          const nameLen = data.readUInt32LE(offset); offset += 4;
          offset += nameLen; // skip name
          const symbolLen = data.readUInt32LE(offset); offset += 4;
          offset += symbolLen; // skip symbol
          const uriLen = data.readUInt32LE(offset); offset += 4;
          const uri = data.slice(offset, offset + uriLen).toString('utf-8').replace(/\0/g, '').trim();

          if (uri && (uri.startsWith('http') || uri.startsWith('ipfs'))) {
            metadataUrl = uri;
            metadata = await getNFTMetadata(metadataUrl);
          }
        }
      } catch (metaErr) {
        console.warn(`Could not fetch Metaplex metadata for ${nft.mint}:`, metaErr.message);
      }

      const processedNft = {
        id: nft.mint,
        tokenId: nft.mint,
        serialNumber: 1,
        name: metadata?.name || `NFT ${nft.mint.substring(0, 8)}...`,
        description: metadata?.description || 'No description available',
        image: metadata?.image || metadata?.imageUrl || null,
        creator: metadata?.creator || null,
        owner: walletAddress,
        attributes: metadata?.attributes || [],
        metadataUrl: metadataUrl,
        rawMetadata: metadata,
        createdAt: null,
        isReal: true,
        relationship: 'owned',
      };

      processedNfts.push(processedNft);
    } catch (error) {
      console.warn(`Failed to process NFT ${nft.mint}:`, error);

      processedNfts.push({
        id: nft.mint,
        tokenId: nft.mint,
        serialNumber: 1,
        name: `NFT ${nft.mint.substring(0, 8)}...`,
        description: 'Unable to load metadata',
        image: null,
        creator: null,
        owner: walletAddress,
        attributes: [],
        metadataUrl: null,
        rawMetadata: null,
        createdAt: null,
        isReal: true,
        relationship: 'owned',
      });
    }
  }

  return processedNfts;
}

/**
 * Check if an NFT is a mock/test NFT (should be filtered out)
 */
export function isMockNFT(nft) {
  // Check for mock indicators
  const mockIndicators = [
    'mock',
    'test',
    'placeholder',
    'example',
    'demo',
    'data:image/svg+xml', // SVG placeholders
    'base64'
  ];
  
  const nftName = (nft.name || '').toLowerCase();
  const nftDescription = (nft.description || '').toLowerCase();
  const nftImage = (nft.image || '').toLowerCase();
  
  return mockIndicators.some(indicator => 
    nftName.includes(indicator) || 
    nftDescription.includes(indicator) || 
    nftImage.includes(indicator)
  );
}

/**
 * Filter out mock NFTs and return only real NFTs
 */
export function filterRealNFTs(nfts) {
  return nfts.filter(nft => !isMockNFT(nft));
}

export default {
  getAccountNFTs,
  getNFTMetadata,
  processNFTData,
  isMockNFT,
  filterRealNFTs
};
