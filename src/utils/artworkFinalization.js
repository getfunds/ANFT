/**
 * Artwork Finalization Utility
 * 
 * Handles the complete artwork preparation flow:
 * 1. Compute content hash from image + metadata
 * 2. Upload image to Filebase IPFS
 * 3. Upload metadata to Filebase IPFS
 * 4. Return all CIDs and content hash
 * 
 * This prepares artwork for NFT minting with attestation
 */

import { computeContentHash } from './contentHashing';
import { uploadNFTToFilebase } from './filebaseIPFS';

/**
 * Finalize artwork by computing hash and uploading to IPFS
 * 
 * This is the main function called during NFT creation flow
 * 
 * @param {Buffer|Blob} imageBuffer - Raw image bytes
 * @param {Object} metadata - NFT metadata (name, description, attributes, etc.)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Finalized artwork data
 */
export async function finalizeArtwork(imageBuffer, metadata, options = {}) {
  try {
    console.log('🎨 ========================================');
    console.log('🎨 Starting Artwork Finalization Process');
    console.log('🎨 ========================================');
    
    const startTime = Date.now();
    
    // Validate inputs
    if (!imageBuffer) {
      throw new Error('Image buffer is required');
    }
    
    if (!metadata || !metadata.name) {
      throw new Error('Metadata with name is required');
    }
    
    console.log('📝 Artwork:', metadata.name);
    console.log('👤 Creator:', metadata.creator || 'Unknown');
    console.log('🆔 Creator DID:', metadata.creator_did || 'None');
    
    // Step 1: Compute content hash
    console.log('\n📊 Step 1: Computing Content Hash...');
    const hashResult = await computeContentHash(imageBuffer, metadata);
    
    console.log('✅ Hashes computed:');
    console.log('   🖼️  Image Hash:', hashResult.imageHash);
    console.log('   📋 Metadata Hash:', hashResult.metadataHash);
    console.log('   🔐 Content Hash:', hashResult.contentHash);
    
    // Step 2: Prepare enhanced metadata with hashes
    const enhancedMetadata = {
      ...metadata,
      // Add content hash information
      content_hash: hashResult.contentHash,
      image_hash: hashResult.imageHash,
      metadata_hash: hashResult.metadataHash,
      // Add timestamps
      finalized_at: new Date().toISOString(),
      // Add image info
      image_size_bytes: hashResult.imageSize,
      // Ensure attributes array exists (without adding duplicates here, will be added in create/paint pages)
      attributes: metadata.attributes || []
    };
    
    // Step 3: Upload to Filebase IPFS
    console.log('\n📤 Step 2: Uploading to Filebase IPFS...');
    
    // Generate filename based on content hash
    const imageFileName = `artwork-${hashResult.contentHash.substring(0, 16)}.${options.format || 'png'}`;
    
    console.log('📁 Image filename:', imageFileName);
    
    const ipfsResult = await uploadNFTToFilebase(
      imageBuffer,
      enhancedMetadata,
      imageFileName
    );
    
    console.log('✅ Upload complete:');
    console.log('   🖼️  Image CID:', ipfsResult.imageHash);
    console.log('   📋 Metadata CID:', ipfsResult.metadataHash);
    console.log('   🌐 Image URL:', ipfsResult.imageUrl);
    console.log('   🌐 Metadata URL:', ipfsResult.metadataUrl);
    
    // Step 4: Prepare final result
    const finalizedArtwork = {
      // Content hashes
      contentHash: hashResult.contentHash,
      imageHash: hashResult.imageHash,
      metadataHash: hashResult.metadataHash,
      
      // IPFS CIDs
      imageCID: ipfsResult.imageHash,
      metadataCID: ipfsResult.metadataHash,
      
      // IPFS URLs
      imageUrl: ipfsResult.imageUrl,
      metadataUrl: ipfsResult.metadataUrl,
      
      // Metadata
      metadata: enhancedMetadata,
      canonicalMetadata: hashResult.canonicalMetadata,
      
      // Additional info
      imageSize: hashResult.imageSize,
      fileName: imageFileName,
      finalizedAt: enhancedMetadata.finalized_at,
      
      // Creator info (for attestation)
      creator: metadata.creator,
      creatorDID: metadata.creator_did,
      
      // Processing time
      processingTimeMs: Date.now() - startTime
    };
    
    console.log('\n🎉 ========================================');
    console.log('🎉 Artwork Finalization Complete!');
    console.log('🎉 ========================================');
    console.log('⏱️  Processing time:', finalizedArtwork.processingTimeMs, 'ms');
    console.log('🔐 Content Hash:', finalizedArtwork.contentHash);
    console.log('📦 Image CID:', finalizedArtwork.imageCID);
    console.log('📋 Metadata CID:', finalizedArtwork.metadataCID);
    console.log('\n✅ Ready for NFT minting with attestation!\n');
    
    return finalizedArtwork;
    
  } catch (error) {
    console.error('❌ Artwork finalization failed:', error);
    throw new Error(`Failed to finalize artwork: ${error.message}`);
  }
}

/**
 * Prepare artwork from AI generation
 * Wrapper for AI-generated images
 * 
 * @param {Blob} imageBlob - Generated image blob
 * @param {string} prompt - AI prompt used
 * @param {Object} metadata - Base metadata
 * @returns {Promise<Object>} Finalized artwork
 */
export async function finalizeAIArtwork(imageBlob, prompt, metadata) {
  console.log('🤖 Finalizing generated artwork...');
  
  const enhancedMetadata = {
    ...metadata,
    ai_generated: true,
    ai_prompt_hash: require('crypto')
      .createHash('sha256')
      .update(prompt)
      .digest('hex'),
    generation_method: 'AI'
    // Note: attributes are passed through from metadata, enhanced in create page
  };
  
  return finalizeArtwork(imageBlob, enhancedMetadata, { format: 'png' });
}

/**
 * Prepare artwork from digital painting
 * Wrapper for canvas/painting studio images
 * 
 * @param {Blob} imageBlob - Painted image blob
 * @param {Object} metadata - Base metadata
 * @returns {Promise<Object>} Finalized artwork
 */
export async function finalizePaintedArtwork(imageBlob, metadata) {
  console.log('🎨 Finalizing painted artwork...');
  
  const enhancedMetadata = {
    ...metadata,
    ai_generated: false,
    generation_method: 'Digital Painting'
    // Note: attributes are passed through from metadata, enhanced in paint page
  };
  
  return finalizeArtwork(imageBlob, enhancedMetadata, { format: 'png' });
}

/**
 * Verify finalized artwork integrity
 * Re-computes hash to ensure artwork hasn't been tampered with
 * 
 * @param {Blob} imageBlob - Image to verify
 * @param {Object} finalizedData - Original finalization result
 * @returns {Promise<boolean>} True if integrity check passes
 */
export async function verifyArtworkIntegrity(imageBlob, finalizedData) {
  try {
    console.log('🔍 Verifying artwork integrity...');
    
    const { contentHash } = await computeContentHash(
      imageBlob,
      finalizedData.metadata
    );
    
    const isValid = contentHash === finalizedData.contentHash;
    
    if (isValid) {
      console.log('✅ Integrity verification PASSED');
    } else {
      console.warn('⚠️ Integrity verification FAILED');
      console.warn('   Expected:', finalizedData.contentHash);
      console.warn('   Got:', contentHash);
    }
    
    return isValid;
    
  } catch (error) {
    console.error('❌ Integrity verification error:', error);
    return false;
  }
}

export default {
  finalizeArtwork,
  finalizeAIArtwork,
  finalizePaintedArtwork,
  verifyArtworkIntegrity
};

