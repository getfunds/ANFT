import { InferenceClient } from '@huggingface/inference';

// High-quality text-to-image models WITHOUT watermarks
// Using models available through Inference Providers
const HUGGING_FACE_MODELS = [
  "black-forest-labs/FLUX.1-dev",
  "stabilityai/stable-diffusion-xl-base-1.0",
  "stabilityai/stable-diffusion-2-1",
  "runwayml/stable-diffusion-v1-5",
  "prompthero/openjourney-v4"
];

const HUGGING_FACE_API_KEY = process.env.NEXT_PUBLIC_HUGGING_FACE_API_KEY;

// Initialize Hugging Face Inference Client with new Inference Providers endpoint
// This uses the new https://router.huggingface.co/hf-inference endpoint
let client = null;
if (HUGGING_FACE_API_KEY && HUGGING_FACE_API_KEY !== 'your_hugging_face_api_key_here') {
  client = new InferenceClient(HUGGING_FACE_API_KEY);
}

// Generate image using Hugging Face Inference Providers API
const generateWithHuggingFace = async (prompt, modelName) => {
  console.log(`🎨 Using Hugging Face Inference Providers with model: ${modelName}`);
  
  try {
    // Use the new InferenceClient.textToImage method
    // This automatically routes to the new Inference Providers endpoint
    const blob = await client.textToImage({
      model: modelName,
      inputs: prompt,
      parameters: {
        negative_prompt: "watermark, signature, text, logo, blurry, low quality",
        num_inference_steps: 30,
        guidance_scale: 7.5,
        width: 512,
        height: 512
      }
    });
    
    console.log(`📊 Generated image size: ${blob.size} bytes (${(blob.size / 1024).toFixed(2)} KB)`);
    
    // Optimize image if it's too large (>2MB) - convert to optimized PNG
    let optimizedBlob = blob;
    if (blob.size > 2 * 1024 * 1024) {
      console.log('⚠️ Image is large, optimizing...');
      optimizedBlob = await optimizeImage(blob);
      console.log(`✅ Optimized to: ${optimizedBlob.size} bytes (${(optimizedBlob.size / 1024).toFixed(2)} KB)`);
    }
    
    const imageBase64 = await blobToBase64(optimizedBlob);
    
    return {
      success: true,
      imageBlob: optimizedBlob,
      imageBase64,
      prompt,
      timestamp: new Date().toISOString(),
      model: modelName
    };
  } catch (error) {
    console.warn(`❌ Hugging Face model ${modelName} failed:`, error.message);
    throw error;
  }
};

// Optimize image by converting to compressed PNG
const optimizeImage = async (blob) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Convert to blob with compression
      canvas.toBlob(
        (optimizedBlob) => {
          URL.revokeObjectURL(url);
          resolve(optimizedBlob);
        },
        'image/png',
        0.85 // 85% quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for optimization'));
    };
    
    img.src = url;
  });
};

// Generate image from text prompt
export const generateImageFromPrompt = async (prompt, options = {}) => {
  console.log('🤖 Starting AI image generation for prompt:', prompt);

  // Check if Hugging Face API key is configured
  if (!HUGGING_FACE_API_KEY || HUGGING_FACE_API_KEY === 'your_hugging_face_api_key_here') {
    throw new Error('Hugging Face API key not configured. Get one from https://huggingface.co/settings/tokens and add to .env.local as NEXT_PUBLIC_HUGGING_FACE_API_KEY');
  }

  let lastError = null;

  // Try each Hugging Face model
  for (const modelName of HUGGING_FACE_MODELS) {
    try {
      const result = await generateWithHuggingFace(prompt, modelName);
      console.log(`✅ Successfully generated image with ${modelName}`);
      return result;
    } catch (error) {
      console.warn(`⚠️ Model ${modelName} failed, trying next model...`);
      lastError = error;
      
      // If model is loading, wait and retry
      if (error.message?.includes('loading') || error.message?.includes('503')) {
        console.log(`⏳ Model ${modelName} is loading, waiting 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Retry once after waiting
        try {
          const result = await generateWithHuggingFace(prompt, modelName);
          console.log(`✅ Successfully generated image with ${modelName} after retry`);
          return result;
        } catch (retryError) {
          console.warn(`❌ Retry failed for ${modelName}`);
          lastError = retryError;
        }
      }
      
      continue;
    }
  }

  // If all models failed
  const errorMsg = `All AI models failed to generate image. Last error: ${lastError?.message}. Please try again in a moment.`;
  console.error('❌', errorMsg);
  throw new Error(errorMsg);
};

// Convert blob to base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Upload image to IPFS (using Filebase IPFS service)
export const uploadImageToIPFS = async (imageBlob, metadata) => {
  try {
    console.log('🎨 Starting NFT upload to Filebase IPFS...');

    // Import Filebase utility
    const { uploadNFTToFilebase } = await import('./filebaseIPFS');

    // Generate image filename
    const timestamp = Date.now();
    const imageFileName = `ai-art-${timestamp}.png`;

    // Create NFT metadata structure
    const nftMetadata = {
      name: metadata.name || "Generated Artwork",
      description: metadata.description || "Unique artwork created on ANFT",
      // image URL will be added by uploadNFTToFilebase
      attributes: [
        {
          trait_type: "Generation Method",
          value: "Stable Diffusion 2.1"
        },
        {
          trait_type: "Created At",
          value: new Date().toISOString()
        },
        {
          trait_type: "Creator",
          value: metadata.creator || "Unknown"
        },
        ...(metadata.attributes || [])
      ],
      external_url: metadata.externalUrl || "",
      animation_url: "",
      properties: {
        category: "Digital Art",
        creator: metadata.creator || "Unknown",
        generatedAt: new Date().toISOString()
      }
    };

    // Upload to Filebase IPFS (image + metadata)
    const result = await uploadNFTToFilebase(imageBlob, nftMetadata, imageFileName);

    console.log('✅ NFT uploaded to Filebase IPFS successfully');

    return {
      success: true,
      imageUrl: result.imageUrl,
      imageHash: result.imageHash,
      metadataUrl: result.metadataUrl,
      metadataHash: result.metadataHash,
      metadata: result.metadata
    };
  } catch (error) {
    console.error("❌ Error uploading to Filebase IPFS:", error);
    throw new Error(`Failed to upload to Filebase IPFS: ${error.message}`);
  }
};

// Encrypt prompt for storage
export const encryptPrompt = (prompt, key) => {
  try {
    // Simple encryption - in production, use proper encryption
    const encoded = btoa(prompt + '|' + key);
    return encoded;
  } catch (error) {
    console.error("Error encrypting prompt:", error);
    throw error;
  }
};

// Decrypt prompt (only for NFT owner)
export const decryptPrompt = (encryptedPrompt, key) => {
  try {
    const decoded = atob(encryptedPrompt);
    const [originalPrompt, originalKey] = decoded.split('|');
    
    if (originalKey !== key) {
      throw new Error("Invalid key for decryption");
    }
    
    return originalPrompt;
  } catch (error) {
    console.error("Error decrypting prompt:", error);
    throw new Error("Failed to decrypt prompt");
  }
};

// Validate prompt for content safety
export const validatePrompt = (prompt) => {
  const bannedWords = [
    'violence', 'weapon', 'gore', 'explicit', 'nsfw', 'nude', 'naked',
    'sexual', 'porn', 'adult', 'inappropriate', 'offensive'
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  const containsBannedContent = bannedWords.some(word => lowerPrompt.includes(word));
  
  if (containsBannedContent) {
    throw new Error("Prompt contains inappropriate content. Please modify your prompt.");
  }
  
  if (prompt.length > 500) {
    throw new Error("Prompt is too long. Please keep it under 500 characters.");
  }
  
  if (prompt.length < 3) {
    throw new Error("Prompt is too short. Please provide a more descriptive prompt.");
  }
  
  return true;
};

// Generate variations of a prompt
export const generatePromptVariations = (basePrompt) => {
  const styles = [
    "photorealistic, highly detailed",
    "digital art, concept art",
    "oil painting, classical style",
    "watercolor, artistic",
    "3D render, modern",
    "sketch, pencil drawing",
    "abstract art, contemporary",
    "pixel art, retro style"
  ];
  
  const qualities = [
    "masterpiece, best quality",
    "ultra high resolution, 4K",
    "professional artwork",
    "award winning art",
    "trending on artstation"
  ];
  
  const variations = [];
  
  styles.forEach(style => {
    qualities.forEach(quality => {
      variations.push(`${basePrompt}, ${style}, ${quality}`);
    });
  });
  
  return variations.slice(0, 8); // Return first 8 variations
};
