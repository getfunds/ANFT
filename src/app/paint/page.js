'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DigitalPaintingStudioModern from '../../components/DigitalPaintingStudioModern';
import ListNFTModal from '../../components/ListNFTModal';
import { useWallet } from '../../hooks/useWalletAdapter';
import { useDID } from '../../hooks/useDID';
import DIDRegistrationModal from '../../components/DIDRegistrationModal';
import { finalizeArtwork } from '../../utils/artworkFinalization';
import { mintNFTWorkflow } from '../../utils/solanaNFTMinting';
import styles from './paint.module.css';

const PaintPage = () => {
  const router = useRouter();
  const { isConnected, accountId, walletAdapter } = useWallet();
  
  const {
    didInfo,
    showDIDModal,
    isLoadingDID,
    ensureDIDBeforeMint,
    completeDIDRegistration,
    cancelDIDRegistration
  } = useDID(accountId, walletAdapter);
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedImage, setExportedImage] = useState(null);
  const [mintedNFT, setMintedNFT] = useState(null);
  const [showListNFTModal, setShowListNFTModal] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [nftName, setNftName] = useState('');
  const [nftDescription, setNftDescription] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  
  const [mintingStep, setMintingStep] = useState('');
  const [mintingProgress, setMintingProgress] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [mintResult, setMintResult] = useState(null);

  const handleMintFromStudio = useCallback((imageData) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      router.push('/wallet');
      return;
    }
    setExportedImage({ dataURL: imageData, format: 'png' });
    setNftName(`Digital Painting ${new Date().toLocaleDateString()}`);
    setNftDescription('Original digital artwork created with ANFT Digital Painting Studio');
    setShowMintModal(true);
  }, [isConnected, router]);

  const handleExport = useCallback((dataURL, format) => {
    setExportedImage({ dataURL, format });
    setShowExportModal(true);
  }, []);

  const handleSave = useCallback((paintingData) => {
    localStorage.setItem(`painting_${Date.now()}`, JSON.stringify(paintingData));
  }, []);


  const addProgressStep = (step, status = 'processing') => {
    setMintingProgress(prev => [...prev, { step, status, timestamp: new Date() }]);
  };

  const updateProgressStep = (step, status, details = null) => {
    setMintingProgress(prev => 
      prev.map(p => p.step === step ? { ...p, status, details, timestamp: new Date() } : p)
    );
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setMintResult(null);
    setMintingProgress([]);
    setShowMintModal(false);
  };

  const executeMinting = useCallback(async () => {
    if (!exportedImage || !nftName.trim()) {
      alert('Please provide an NFT name');
      return;
    }
    
    try {
      setIsMinting(true);
      setMintingProgress([]);
      setMintingStep('Initializing minting process...');
      
      setMintingStep('Step 1/3: Verifying your creator identity');
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
      // Convert data URL to blob
      const response = await fetch(exportedImage.dataURL);
      const blob = await response.blob();
      
      setMintingStep('Step 2/3: Preparing your artwork');
      addProgressStep('Content Hashing', 'processing');
      
      const { finalizePaintedArtwork } = await import('../../utils/artworkFinalization');
      
      const finalizedArtwork = await finalizePaintedArtwork(
        blob,
        {
          name: nftName,
          description: nftDescription,
          creator: accountId,
          creator_did: userDID.did,
          attributes: [
            { trait_type: "Creation Date", value: new Date().toISOString() },
            { trait_type: "Creation Method", value: "Digital Painting" },
            { trait_type: "Studio", value: "ANFT Digital Painting Studio" }
          ]
        }
      );
      
      updateProgressStep('Content Hashing', 'completed', {
        contentHash: finalizedArtwork.contentHash,
        imageCID: finalizedArtwork.imageCID,
        metadataCID: finalizedArtwork.metadataCID,
        message: 'Content hash computed and uploaded to IPFS'
      });

      setMintingStep('Step 3/3: Minting NFT on Solana (please approve in wallet)');
      addProgressStep('Atomic Mint', 'processing');

      if (!walletAdapter) {
        throw new Error('Wallet not connected properly');
      }

      const nftMetadata = {
        name: nftName,
        symbol: 'DGTART',
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
          imageHash: finalizedArtwork.imageHash,
          metadataHash: finalizedArtwork.metadataHash,
          imageCID: finalizedArtwork.imageCID,
          metadataCID: finalizedArtwork.metadataCID,
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
        name: nftName,
        description: nftDescription,
        image: finalizedArtwork.imageUrl,
        metadata: nftMetadata,
        explorerUrl: solanaResult.explorerUrl,
      };
      
      setMintedNFT(successResult);
      setMintResult(successResult);
      
      setIsMinting(false);
      setShowMintModal(false);
      setShowSuccessModal(true);
      setMintingStep('');
      
    } catch (error) {
      alert(`❌ Failed to mint NFT: ${error.message}\n\nPlease try again or check your wallet connection.`);
    } finally {
      if (!mintResult) {
        setIsMinting(false);
        setMintingStep('');
        setMintingProgress([]);
      }
    }
  }, [exportedImage, accountId, walletAdapter, nftName, nftDescription, ensureDIDBeforeMint, mintResult]);

  const handleDownload = useCallback(() => {
    if (!exportedImage) return;
    
    const link = document.createElement('a');
    link.download = `digital_painting_${Date.now()}.${exportedImage.format}`;
    link.href = exportedImage.dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [exportedImage]);

  const handleListForSale = useCallback(async (price, duration) => {
    if (!mintedNFT) return;
    
    try {
      const { createMarketplaceListing } = await import('../../utils/marketplace');
      
      // Create marketplace listing using connected wallet
      const listingResult = await createMarketplaceListing({
        tokenAddress: mintedNFT.tokenId,
        tokenId: mintedNFT.serialNumber,
        price: price,
        duration: parseInt(duration),
        isAuction: false,
        royaltyPercentage: 500, // 5% royalty
        royaltyRecipient: accountId
      }, walletAdapter, accountId);
      
      alert(`🎉 Digital Painting Listed Successfully!\n\n🎨 ${mintedNFT.name}\n💰 Price: ${price} SOL\n⏰ Duration: ${duration / 86400} days\n\n✅ Your painting is now available in the marketplace!`);
      
      setShowListNFTModal(false);
      setTimeout(() => {
        router.push('/marketplace');
      }, 1000);
      
    } catch (error) {
      alert(`❌ Failed to list NFT: ${error.message}\n\nPlease ensure your NFT is approved for the marketplace.`);
    }
  }, [mintedNFT, router]);

  return (
    <div className={styles.paintPage}>
      <main className={styles.main}>
        <DigitalPaintingStudioModern 
          onMintNFT={handleMintFromStudio}
          onListForSale={handleListForSale}
        />
      </main>

      {showExportModal && exportedImage && (
        <div className={styles.modalOverlay}>
          <div className={styles.exportModal}>
            <div className={styles.modalHeader}>
              <h2>🎨 Artwork Ready!</h2>
              <button 
                onClick={() => setShowExportModal(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.previewContainer}>
                <img 
                  src={exportedImage.dataURL} 
                  alt="Exported artwork"
                  className={styles.artworkPreview}
                />
              </div>
              
              <div className={styles.exportInfo}>
                <p><strong>Format:</strong> {exportedImage.format.toUpperCase()}</p>
                <p><strong>Created:</strong> {new Date().toLocaleString()}</p>
                <p><strong>Size:</strong> {Math.round(exportedImage.dataURL.length / 1024)} KB</p>
              </div>
              
              <div className={styles.exportActions}>
                <button 
                  onClick={handleDownload}
                  className={styles.downloadButton}
                >
                  📥 Download Image
                </button>
              </div>
              
              <div className={styles.modalFooter}>
                <p className={styles.footerText}>
                  💡 <strong>Tip:</strong> Use the &quot;🎨 Mint NFT&quot; button in the top toolbar to mint your artwork as an NFT on Solana!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMintModal && exportedImage && (
        <div className={styles.modalOverlay}>
          <div className={styles.mintModal}>
            <div className={styles.modalHeader}>
              <h2>🪙 Mint Your Digital Painting as NFT</h2>
              <button 
                onClick={() => setShowMintModal(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.previewContainer}>
                <img 
                  src={exportedImage.dataURL} 
                  alt="Painting preview"
                  className={styles.artworkPreview}
                />
              </div>
              
              <div className={styles.inputGroup}>
                <label htmlFor="nftName">NFT Name / Title *</label>
                <input
                  id="nftName"
                  type="text"
                  value={nftName}
                  onChange={(e) => setNftName(e.target.value)}
                  placeholder="Enter NFT name..."
                  className={styles.inputField}
                  maxLength={100}
                />
              </div>
              
              <div className={styles.inputGroup}>
                <label htmlFor="nftDescription">Description</label>
                <textarea
                  id="nftDescription"
                  value={nftDescription}
                  onChange={(e) => setNftDescription(e.target.value)}
                  placeholder="Describe your digital painting..."
                  className={styles.textareaField}
                  rows={4}
                  maxLength={500}
                />
              </div>
              
              <div className={styles.mintInfo}>
                <p>🎨 <strong>Artwork Type:</strong> Digital Painting</p>
                <p>👤 <strong>Creator:</strong> {accountId}</p>
                <p>📅 <strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                <p>💾 <strong>Format:</strong> {exportedImage.format.toUpperCase()}</p>
              </div>
              
              <div className={styles.mintActions}>
                <button 
                  onClick={() => setShowMintModal(false)}
                  className={styles.cancelButton}
                  disabled={isMinting}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeMinting}
                  disabled={isMinting || !nftName.trim()}
                  className={styles.confirmMintButton}
                >
                  {isMinting ? (
                    <>
                      <div className={styles.spinner}></div>
                      Minting...
                    </>
                  ) : (
                    <>
                      🪙 Mint NFT
                    </>
                  )}
                </button>
              </div>

              {/* Minting Progress Display */}
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
                            <div className={styles.spinner}></div>
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
              
              <div className={styles.modalFooter}>
                <p className={styles.footerText}>
                  💡 <strong>Note:</strong> Your painting will be uploaded to IPFS and minted as an NFT on Solana. This process is permanent and cannot be reversed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && mintResult && (
        <div className={styles.successModalOverlay} onClick={closeSuccessModal}>
          <div className={styles.successModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.successHeader}>
              <div className={styles.successIcon}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className={styles.successTitle}>Digital Painting Minted! 🎨</h2>
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
              <button
                onClick={() => {
                  closeSuccessModal();
                  router.push('/profile');
                }}
                className={styles.successButtonSecondary}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                View My NFTs
              </button>
            </div>

            <button onClick={closeSuccessModal} className={styles.closeModalButton}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Listing Modal */}
      {showListNFTModal && mintedNFT && (
        <ListNFTModal 
          nft={mintedNFT}
          onClose={() => setShowListNFTModal(false)}
          onList={handleListForSale}
        />
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

export default PaintPage;
