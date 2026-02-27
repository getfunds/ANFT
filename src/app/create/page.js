'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '../../hooks/useWalletAdapter';
import { generateImageFromPrompt, validatePrompt, generatePromptVariations, encryptPrompt } from '../../utils/aiImageGeneration';
import { useDID } from '../../hooks/useDID';
import { finalizeAIArtwork, finalizePaintedArtwork } from '../../utils/artworkFinalization';
import { mintNFTWorkflow } from '../../utils/solanaNFTMinting';
import DIDRegistrationModal from '../../components/DIDRegistrationModal';
import ConnectWalletPrompt from '../../components/ConnectWalletPrompt';
import styles from './page.module.css';

const CreatePage = () => {
  const { isConnected, accountId, connectedWalletType, walletAdapter } = useWallet();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showVariations, setShowVariations] = useState(false);
  const [promptVariations, setPromptVariations] = useState([]);
  const [mintingStep, setMintingStep] = useState('');
  const [mintingProgress, setMintingProgress] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [mintResult, setMintResult] = useState(null);
  const [nftName, setNftName] = useState('');
  const [nftDescription, setNftDescription] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [isPaintingMode, setIsPaintingMode] = useState(false);
  const [paintingArtwork, setPaintingArtwork] = useState(null);

  const {
    didInfo,
    hasDID,
    showDIDModal,
    isLoadingDID,
    ensureDIDBeforeMint,
    completeDIDRegistration,
    cancelDIDRegistration
  } = useDID(accountId, walletAdapter);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('source');
    
    if (source === 'painting') {
      const pendingArtwork = sessionStorage.getItem('pendingArtwork');
      if (pendingArtwork) {
        try {
          const artworkData = JSON.parse(pendingArtwork);
          setPaintingArtwork(artworkData);
          setIsPaintingMode(true);
          setSelectedImage(artworkData.file);
          setNftName(artworkData.name || '');
          setNftDescription(artworkData.description || '');
          setCurrentStep(3);
          sessionStorage.removeItem('pendingArtwork');
        } catch {
          setError('Failed to load painting artwork');
        }
      }
    }
  }, []);

  const handlePromptChange = (e) => {
    setPrompt(e.target.value);
    setError('');
  };

  const generateVariations = () => {
    if (prompt.trim()) {
      const variations = generatePromptVariations(prompt.trim());
      setPromptVariations(variations);
      setShowVariations(true);
    }
  };

  const applyVariation = (variation) => {
    setPrompt(variation);
    setShowVariations(false);
  };

  const generateImage = async (promptToUse = prompt) => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setIsGenerating(true);
      setError('');
      setSuccess('');

      validatePrompt(promptToUse);
      const result = await generateImageFromPrompt(promptToUse, {
        width: 512,
        height: 512,
        steps: 30,
        guidance: 7.5
      });

      const newImage = {
        id: Date.now(),
        prompt: promptToUse,
        imageBase64: result.imageBase64,
        imageBlob: result.imageBlob,
        timestamp: result.timestamp,
        model: result.model
      };

      setGeneratedImages(prev => [newImage, ...prev]);
      setSuccess(`AI image generated successfully using ${result.model}!`);
      setCurrentStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectImage = (image) => {
    setSelectedImage(image);
    setNftName(`Artwork - ${new Date(image.timestamp).toLocaleDateString()}`);
    setNftDescription(`Unique artwork created with the prompt: "${image.prompt.substring(0, 100)}${image.prompt.length > 100 ? '...' : ''}"`);
    setCurrentStep(3);
  };

  const addProgressStep = (step, status = 'processing') => {
    setMintingProgress(prev => [...prev, { step, status, timestamp: new Date() }]);
  };

  const updateProgressStep = (step, status, details = null) => {
    setMintingProgress(prev => 
      prev.map(p => p.step === step ? { ...p, status, details, timestamp: new Date() } : p)
    );
  };

  const mintNFT = async () => {
    if (!selectedImage || !nftName.trim()) {
      setError('Please select an image and provide a name');
      return;
    }

    try {
      setIsMinting(true);
      setError('');
      setMintingProgress([]);
      setMintingStep('Initializing minting process...');

      setMintingStep('Step 1/4: Verifying your creator identity');
      addProgressStep('DID Verification', 'processing');
      
      const userDID = await ensureDIDBeforeMint();
      
      if (!userDID) {
        setIsMinting(false);
        setMintingProgress([]);
        return;
      }
      
      updateProgressStep('DID Verification', 'completed', {
        did: userDID.did,
        message: userDID.isNew ? 'New DID will be created with mint' : 'Existing DID found and verified'
      });
      setMintingStep('Step 2/4: Preparing your artwork');
      addProgressStep('Content Hashing', 'processing');
      
      const isPainted = isPaintingMode || selectedImage.isPainted;
      let finalizedArtwork;
      
      if (isPainted) {
        finalizedArtwork = await finalizePaintedArtwork(
          selectedImage.imageBlob,
          {
            name: nftName,
            description: nftDescription,
            creator: accountId,
            creator_did: userDID.did,
            attributes: [
              { trait_type: "Creation Date", value: new Date().toISOString() },
              { trait_type: "Creation Method", value: "Digital Painting" }
            ]
          }
        );
      } else {
        const encryptedPrompt = encryptPrompt(selectedImage.prompt, accountId);
        
        finalizedArtwork = await finalizeAIArtwork(
          selectedImage.imageBlob,
          selectedImage.prompt,
          {
            name: nftName,
            description: nftDescription,
            creator: accountId,
            creator_did: userDID.did,
            ai_prompt: encryptedPrompt,
            ai_model: selectedImage.model || 'Stable Diffusion 2.1',
            attributes: [
              { trait_type: "Generation Date", value: new Date(selectedImage.timestamp).toISOString() }
            ]
          }
        );
      }
      
      updateProgressStep('Content Hashing', 'completed', {
        contentHash: finalizedArtwork.contentHash,
        imageCID: finalizedArtwork.imageCID,
        metadataCID: finalizedArtwork.metadataCID,
        message: 'Content hash computed and uploaded to IPFS'
      });

      setMintingStep('Step 3/4: Minting NFT on Solana (please approve in wallet)');
      addProgressStep('Atomic Mint', 'processing');

      if (!walletAdapter) {
        throw new Error('Wallet not connected properly');
      }

      const nftMetadata = {
        name: nftName,
        symbol: isPainted ? 'DGTART' : 'AIART',
        description: nftDescription,
        image: finalizedArtwork.imageUrl,
        external_url: finalizedArtwork.metadataUrl,
        creator: accountId,
        creator_did: userDID.did,
        content_hash: finalizedArtwork.contentHash,
        image_hash: finalizedArtwork.imageHash,
        metadata_hash: finalizedArtwork.metadataHash,
        image_ipfs_cid: finalizedArtwork.imageCID,
        metadata_ipfs_cid: finalizedArtwork.metadataCID,
        attributes: [
          ...finalizedArtwork.metadata.attributes,
          { trait_type: 'Creator DID', value: userDID.did },
          { trait_type: 'Content Hash', value: finalizedArtwork.contentHash },
        ]
      };

      const solanaResult = await mintNFTWorkflow(
        walletAdapter,
        nftMetadata,
        {
          username: userDID.isNew ? userDID.username : null,
          existingDID: userDID.isNew ? null : userDID,
          contentHash: finalizedArtwork.contentHash,
          royaltyBps: 500,
        },
        (status) => setMintingStep(status)
      );

      updateProgressStep('Atomic Mint', 'completed', {
        tokenId: solanaResult.mint.tokenId,
        transactionId: solanaResult.mint.transactionId,
        message: 'NFT minted successfully with complete provenance'
      });

      const successResult = {
        tokenId: solanaResult.mint.tokenId,
        serialNumber: 1,
        transactionId: solanaResult.mint.transactionId,
        contentHash: finalizedArtwork.contentHash,
        attestationTx: solanaResult.attestation?.attestationAddress || '',
        nftUrl: solanaResult.nftUrl,
        attestationUrl: solanaResult.attestationUrl,
        creatorDID: userDID.did,
        imageCID: finalizedArtwork.imageCID,
        metadataCID: finalizedArtwork.metadataCID,
        metadata: nftMetadata,
        success: true,
        isReal: true,
        explorerUrl: solanaResult.explorerUrl,
      };

      setMintResult(successResult);

      setIsMinting(false);
      setShowSuccessModal(true);
      setMintingStep('');
      setTimeout(() => {
        setSelectedImage(null);
        setNftName('');
        setNftDescription('');
        setGeneratedImages([]);
      }, 500);
      
    } catch (err) {
      if (err.message.includes('Wallet not connected') || err.message.includes('not found')) {
        setError('Please connect your Solana wallet first before minting NFTs.');
      } else if (err.message.includes('Insufficient') || err.message.includes('insufficient')) {
        setError('Insufficient SOL balance. Please add SOL to your wallet for transaction fees.');
      } else if (err.message.includes('rejected') || err.message.includes('denied')) {
        setError('Transaction rejected by user.');
      } else {
        setError(`Error: ${err.message}`);
      }
    } finally {
      if (!mintResult) {
        setIsMinting(false);
        setMintingStep('');
        setMintingProgress([]);
      }
    }
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setMintResult(null);
    setMintingProgress([]);
  };

  const StepIndicator = () => (
    <div className={styles.stepIndicator}>
      <div className={`${styles.step} ${currentStep >= 1 ? (currentStep === 1 ? 'active' : 'completed') : 'pending'}`}>
        <div className={styles.stepNumber}>1</div>
        <span>Generate Art</span>
      </div>
      <div className={`${styles.step} ${currentStep >= 2 ? (currentStep === 2 ? 'active' : 'completed') : 'pending'}`}>
        <div className={styles.stepNumber}>2</div>
        <span>Select Image</span>
      </div>
      <div className={`${styles.step} ${currentStep >= 3 ? 'active' : 'pending'}`}>
        <div className={styles.stepNumber}>3</div>
        <span>Mint NFT</span>
      </div>
    </div>
  );

  if (!isConnected) {
    return <ConnectWalletPrompt title="Create NFTs" description="Please connect your Solana wallet to start creating authentic NFTs." />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          {isPaintingMode ? (
            <> Mint <span className={styles.gradientText}>Digital Painting</span></>
          ) : (
            <>Create <span className={styles.gradientText}>NFT Artwork</span></>
          )}
        </h1>
        <p className={styles.subtitle}>
          {isPaintingMode ? (
            <>Your digital painting is ready to be minted as an NFT on Solana</>
          ) : (
            <>Transform your imagination into unique digital art using AI, then mint as NFTs on Solana</>
          )}
        </p>
        {isPaintingMode && paintingArtwork && (
          <div className={styles.paintingInfo}>
            <div className={styles.paintingBadge}>
              Digital Painting Studio
            </div>
            <p className={styles.paintingDetails}>
              Created: {new Date(paintingArtwork.created).toLocaleString()} • 
              Format: {paintingArtwork.format?.toUpperCase() || 'PNG'}
            </p>
          </div>
        )}
      </div>

      <StepIndicator />

      <div className={styles.mainContent}>
        <div className={styles.promptSection}>
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Describe Your Vision</h2>
          
            <div className={styles.formGroup}>
              <label className={styles.label}>
                AI Prompt
              </label>
              <textarea
                value={prompt}
                onChange={handlePromptChange}
                placeholder="Describe the image you want to create... (e.g., 'A majestic dragon flying over a mystical forest at sunset, digital art style')"
                className={styles.textarea}
                rows={4}
              />
              <p className={styles.promptHint}>
                {prompt.length}/500 characters
              </p>
            </div>

            <div className={styles.buttonGroup}>
              <button
                onClick={() => generateImage()}
                disabled={!prompt.trim() || isGenerating}
                className={styles.primaryButton}
              >
                {isGenerating ? (
                  <>
                    <div className={styles.loadingSpinner}></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Image
                  </>
                )}
              </button>

              <button
                onClick={generateVariations}
                disabled={!prompt.trim()}
                className={styles.secondaryButton}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Generate Variations
              </button>
            </div>

            {showVariations && (
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Prompt Variations:</h3>
                <div className="space-y-2">
                  {promptVariations.map((variation, index) => (
                    <button
                      key={index}
                      onClick={() => applyVariation(variation)}
                      className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors"
                    >
                      {variation}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className={`${styles.statusMessage} ${styles.statusError}`}>
                <svg className={styles.statusIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {success && (
              <div className={`${styles.statusMessage} ${styles.statusSuccess}`}>
                <svg className={styles.statusIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {success}
              </div>
            )}
          </div>
        </div>

        <div className={styles.imageSection}>
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Generated Images</h2>
          
          {generatedImages.length === 0 ? (
            <div className={styles.imagePreview}>
              <svg className={styles.placeholderIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className={styles.placeholderText}>No images generated yet</div>
              <div className={styles.placeholderSubtext}>Enter a prompt and click &quot;Generate Image&quot; to get started</div>
            </div>
          ) : (
            <div className={styles.imageGallery}>
              {generatedImages.map((image) => (
                <div
                  key={image.id}
                  className={`${styles.imageCard} ${selectedImage?.id === image.id ? styles.selected : ''}`}
                  onClick={() => selectImage(image)}
                >
                  <Image
                    src={image.imageBase64}
                    alt="Generated artwork"
                    width={300}
                    height={300}
                    className={styles.imagePreviewSmall}
                  />
                  <div className={styles.imageInfo}>
                    <div className={styles.promptText}>{image.prompt}</div>
                    {selectedImage?.id === image.id && (
                      <div className={styles.selectedBadge}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                        Selected for minting
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {selectedImage && (
        <div className={`${styles.card} ${styles.mintingSection}`}>
          <h2 className={styles.sectionTitle}>Mint as NFT</h2>
          
          <div className={styles.mintingGrid}>
            <div className={styles.mintingForm}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                  NFT Name *
                </label>
                <input
                  type="text"
                  value={nftName}
                  onChange={(e) => setNftName(e.target.value)}
                  placeholder="Enter a name for your NFT"
                  className={styles.inputField}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                  Description
                </label>
                <textarea
                  value={nftDescription}
                  onChange={(e) => setNftDescription(e.target.value)}
                  placeholder="Describe your NFT (optional)"
                  className={styles.textareaField}
                  rows={3}
                />
              </div>

              <button
                onClick={mintNFT}
                disabled={!nftName.trim() || isMinting}
                className={styles.mintButton}
              >
                {isMinting ? (
                  <>
                    <div className={styles.loadingSpinner}></div>
                    Minting NFT...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Mint NFT
                  </>
                )}
              </button>

              {isMinting && mintingProgress.length > 0 && (
                <div className={styles.progressContainer}>
                  <div className={styles.progressHeader}>
                    <h3 className={styles.progressTitle}>{mintingStep}</h3>
                  </div>
                  <div className={styles.progressSteps}>
                    {mintingProgress.map((step, index) => (
                      <div key={index} className={`${styles.progressStepItem} ${styles[step.status]}`}>
                        <div className={styles.progressStepIcon}>
                          {step.status === 'completed' && (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          )}
                          {step.status === 'processing' && (
                            <div className={styles.loadingSpinner}></div>
                          )}
                        </div>
                        <div className={styles.progressStepContent}>
                          <div className={styles.progressStepName}>{step.step}</div>
                          {step.details && (
                            <div className={styles.progressStepDetails}>
                              <div className={styles.detailMessage}>{step.details.message}</div>
                              {step.details.did && (
                                <div className={styles.detailValue}>DID: {step.details.did.substring(0, 30)}...</div>
                              )}
                              {step.details.contentHash && (
                                <div className={styles.detailValue}>Hash: {step.details.contentHash.substring(0, 20)}...</div>
                              )}
                              {step.details.tokenId && (
                                <div className={styles.detailValue}>Token: {step.details.tokenId}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.previewContainer}>
              <div className={styles.imagePreviewLarge}>
                <Image
                  src={selectedImage.imageBase64}
                  alt="Selected artwork"
                  fill
                  className={styles.previewImage}
                />
              </div>
              
              <div className={styles.imageMetadata}>
                <div className={styles.metadataItem}>
                  <div className={styles.metadataLabel}>Prompt</div>
                  <div className={styles.promptValue}>{selectedImage.prompt}</div>
                </div>
                
                <div className={styles.metadataItem}>
                  <div className={styles.metadataLabel}>Generated</div>
                  <div className={styles.metadataValue}>
                    {new Date(selectedImage.timestamp).toLocaleString()}
                  </div>
                </div>
                
                <div className={styles.metadataItem}>
                  <div className={styles.metadataLabel}>Creator</div>
                  <div className={styles.metadataValue}>{accountId}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && mintResult && (
        <div className={styles.successModalOverlay} onClick={closeSuccessModal}>
          <div className={styles.successModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.successHeader}>
              <div className={styles.successIcon}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className={styles.successTitle}>NFT Minted Successfully! 🎉</h2>
              <p className={styles.successSubtitle}>
                Your artwork is now an authentic, verified NFT on Solana
              </p>
            </div>

            <div className={styles.successDetails}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Token ID</span>
                <span className={styles.detailValueMono}>{mintResult.tokenId}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Serial Number</span>
                <span className={styles.detailValueMono}>#{mintResult.serialNumber}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Content Hash</span>
                <span className={styles.detailValueMono}>{mintResult.contentHash.substring(0, 20)}...</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Creator DID</span>
                <span className={styles.detailValueMono}>{mintResult.creatorDID.substring(0, 30)}...</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Attestation TX</span>
                <span className={styles.detailValueMono}>{mintResult.attestationTx.substring(0, 20)}...</span>
              </div>
            </div>

            <div className={styles.provenanceChain}>
              <div className={styles.chainTitle}>Immutable Proof Chain</div>
              <div className={styles.chainFlow}>
                <div className={styles.chainStep}>Creator DID</div>
                <div className={styles.chainArrow}>→</div>
                <div className={styles.chainStep}>Content Hash</div>
                <div className={styles.chainArrow}>→</div>
                <div className={styles.chainStep}>Attestation</div>
                <div className={styles.chainArrow}>→</div>
                <div className={styles.chainStep}>NFT</div>
              </div>
            </div>

            <div className={styles.successActions}>
              <a 
                href={mintResult.nftUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.successButton}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                View on Solana Explorer
              </a>
              <Link 
                href="/profile"
                className={styles.successButtonSecondary}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                View My NFTs
              </Link>
            </div>

            <button onClick={closeSuccessModal} className={styles.closeModalButton}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* DID Registration Modal */}
      <DIDRegistrationModal
        isOpen={showDIDModal}
        accountId={accountId}
        onRegister={completeDIDRegistration}
        onClose={cancelDIDRegistration}
        isRegistering={isLoadingDID}
      />
    </div>
  );
};

export default CreatePage;
