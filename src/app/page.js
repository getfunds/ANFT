'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={styles.container}>
      {/* Hero Section - Premium Introduction */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}>
          <div className={styles.gradientOrb} style={{ transform: `translateY(${scrollY * 0.3}px)` }}></div>
          <div className={styles.gradientOrb2} style={{ transform: `translateY(${scrollY * 0.2}px)` }}></div>
          <div className={styles.gridPattern}></div>
        </div>
        
        <div className={styles.heroContent}>
          <div className={styles.heroLabel}>
            <span className={styles.labelDot}></span>
            <span>Authentic NFTs on Solana Network</span>
          </div>
          
          <h1 className={styles.heroTitle}>
            Create, Verify & Trade
            <span className={styles.titleHighlight}> Authentic NFTs</span>
          </h1>
          
          <p className={styles.heroSubtitle}>
          The all-in-one NFT platform powered by decentralized identity, cryptographic content hashing, and on-chain attestations, bringing verifiable authenticity to every NFT artwork creation.
          </p>
          
          <div className={styles.heroActions}>
            <Link href="/create-select" className={styles.heroPrimary}>
              <span>Start Creating</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link href="/marketplace" className={styles.heroSecondary}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="2"/>
                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <span>Explore Marketplace</span>
            </Link>
          </div>
          
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <div className={styles.statNumber}>100%</div>
              <div className={styles.statLabel}>Authentic</div>
            </div>
            <div className={styles.statDivider}></div>
            <div className={styles.stat}>
              <div className={styles.statNumber}>Fast</div>
              <div className={styles.statLabel}>On Solana</div>
            </div>
            <div className={styles.statDivider}></div>
            <div className={styles.stat}>
              <div className={styles.statNumber}>Secure</div>
              <div className={styles.statLabel}>DID Verified</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Pillars Section */}
      <section className={styles.trustSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Three Pillars of Trust</span>
          <h2 className={styles.sectionTitle}>
            Every NFT is <span className={styles.highlight}>Verifiably Authentic</span>
          </h2>
          <p className={styles.sectionDescription}>
          ANFT leverages cutting-edge blockchain technology to guarantee authenticity, authorship, and provenance for every digital artwork.
          </p>
        </div>

        <div className={styles.pillarsGrid}>
          <div className={styles.pillar}>
            <div className={styles.pillarIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className={styles.pillarNumber}>01</div>
            <h3 className={styles.pillarTitle}>Decentralized Identity</h3>
            <p className={styles.pillarDescription}>
              Every creator gets a unique DID on Solana, creating an immutable link 
              between you and your creations that no one can fake or steal.
            </p>
            <div className={styles.pillarFeatures}>
              <div className={styles.feature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Unique blockchain identity</span>
              </div>
              <div className={styles.feature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Cryptographic authorship proof</span>
              </div>
              <div className={styles.feature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Permanent creator attribution</span>
              </div>
            </div>
          </div>

          <div className={styles.pillar}>
            <div className={styles.pillarIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className={styles.pillarNumber}>02</div>
            <h3 className={styles.pillarTitle}>Content Hashing</h3>
            <p className={styles.pillarDescription}>
              Your artwork is cryptographically fingerprinted, making it impossible 
              for anyone to claim they created your work first.
            </p>
            <div className={styles.pillarFeatures}>
              <div className={styles.feature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>SHA-256 content fingerprint</span>
              </div>
              <div className={styles.feature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Tamper-proof verification</span>
              </div>
              <div className={styles.feature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Instant authenticity check</span>
              </div>
            </div>
          </div>

          <div className={styles.pillar}>
            <div className={styles.pillarIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className={styles.pillarNumber}>03</div>
            <h3 className={styles.pillarTitle}>On-Chain Attestation</h3>
            <p className={styles.pillarDescription}>
              A permanent, timestamped record on Solana proves exactly when you 
              created your artwork and links it to your identity forever.
            </p>
            <div className={styles.pillarFeatures}>
              <div className={styles.feature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Immutable timestamp proof</span>
              </div>
              <div className={styles.feature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Public verification record</span>
              </div>
              <div className={styles.feature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Legal-grade provenance</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Creation Methods Section */}
      <section className={styles.methodsSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Dual Creation Paths</span>
          <h2 className={styles.sectionTitle}>
            Create <span className={styles.highlight}>Your Way</span>
          </h2>
          <p className={styles.sectionDescription}>
            Whether you&apos;re a prompt engineer or a digital artist, 
            we provide professional tools for your creative vision.
          </p>
        </div>

        <div className={styles.methodsContainer}>
          <Link href="/create?method=ai" className={styles.methodCard}>
            <div className={styles.methodVisual}>
              <div className={styles.methodIconLarge}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className={styles.methodBadge}>AI Powered</div>
            </div>
            <div className={styles.methodContent}>
              <h3 className={styles.methodTitle}>AI Generation</h3>
              <p className={styles.methodText}>
                Transform text into stunning artwork using advanced AI models. 
                Perfect for rapid ideation and exploring creative concepts.
              </p>
              <div className={styles.methodTags}>
                <span className={styles.tag}>⚡ Instant</span>
                <span className={styles.tag}>🎨 Unlimited</span>
                <span className={styles.tag}>🔐 Encrypted</span>
              </div>
              <div className={styles.methodCta}>
                <span>Generate with AI</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          </Link>

          <Link href="/paint" className={styles.methodCard}>
            <div className={styles.methodVisual}>
              <div className={`${styles.methodIconLarge} ${styles.paintGradient}`}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                  <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className={styles.methodBadge}>Professional Tools</div>
            </div>
            <div className={styles.methodContent}>
              <h3 className={styles.methodTitle}>Digital Painting</h3>
              <p className={styles.methodText}>
                Create original masterpieces with our professional painting studio 
                featuring realistic brushes and advanced artistic tools.
              </p>
              <div className={styles.methodTags}>
                <span className={styles.tag}>🖌️ Pro Tools</span>
                <span className={styles.tag}>🎯 Full Control</span>
                <span className={styles.tag}>✨ Realistic</span>
              </div>
              <div className={styles.methodCta}>
                <span>Open Studio</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* How It Works Section */}
      <section className={styles.processSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Simple Process</span>
          <h2 className={styles.sectionTitle}>
            From Creation to <span className={styles.highlight}>Marketplace</span>
          </h2>
          <p className={styles.sectionDescription}>
            Our streamlined workflow makes it easy to create authentic, 
            verified NFTs in minutes.
          </p>
        </div>

        <div className={styles.processFlow}>
          <div className={styles.processStep}>
            <div className={styles.stepIndicator}>
              <div className={styles.stepBubble}>1</div>
              <div className={styles.stepLine}></div>
            </div>
            <div className={styles.stepDetails}>
              <h3 className={styles.stepHeading}>Choose Creation Method</h3>
              <p className={styles.stepText}>
                Select AI Generation for instant artwork from prompts, or Digital Painting 
                for hands-on creative control with professional tools.
              </p>
            </div>
          </div>

          <div className={styles.processStep}>
            <div className={styles.stepIndicator}>
              <div className={styles.stepBubble}>2</div>
              <div className={styles.stepLine}></div>
            </div>
            <div className={styles.stepDetails}>
              <h3 className={styles.stepHeading}>Create Your Artwork</h3>
              <p className={styles.stepText}>
                Generate artwork from your imagination or paint original masterpieces 
                with our advanced digital studio. Iterate until perfect.
              </p>
            </div>
          </div>

          <div className={styles.processStep}>
            <div className={styles.stepIndicator}>
              <div className={styles.stepBubble}>3</div>
              <div className={styles.stepLine}></div>
            </div>
            <div className={styles.stepDetails}>
              <h3 className={styles.stepHeading}>Verify & Mint</h3>
              <p className={styles.stepText}>
                Connect your wallet to establish your DID, generate content hash, 
                create attestation, and mint your NFT on Solana&apos;s secure network.
              </p>
            </div>
          </div>

          <div className={styles.processStep}>
            <div className={styles.stepIndicator}>
              <div className={styles.stepBubble}>4</div>
            </div>
            <div className={styles.stepDetails}>
              <h3 className={styles.stepHeading}>Trade with Confidence</h3>
              <p className={styles.stepText}>
                List your verified NFTs in the marketplace. Buyers can trust the authenticity 
                with blockchain-verified provenance and creator identity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section className={styles.featuresSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Platform Features</span>
          <h2 className={styles.sectionTitle}>
            Built for <span className={styles.highlight}>Creators</span>
          </h2>
        </div>

        <div className={styles.featuresGrid}>
          <div className={styles.featureBox}>
            <div className={styles.featureIconBox}>⚡</div>
            <h4 className={styles.featureHeading}>Lightning Fast</h4>
            <p className={styles.featureText}>Powered by Solana&apos;s high-performance network with sub-second finality</p>
          </div>
          <div className={styles.featureBox}>
            <div className={styles.featureIconBox}>🔒</div>
            <h4 className={styles.featureHeading}>Bank-Grade Security</h4>
            <p className={styles.featureText}>Military-grade encryption and decentralized identity protection</p>
          </div>
          <div className={styles.featureBox}>
            <div className={styles.featureIconBox}>🌱</div>
            <h4 className={styles.featureHeading}>Eco-Friendly</h4>
            <p className={styles.featureText}>Carbon-negative blockchain with minimal environmental impact</p>
          </div>
          <div className={styles.featureBox}>
            <div className={styles.featureIconBox}>💎</div>
            <h4 className={styles.featureHeading}>Low Fees</h4>
            <p className={styles.featureText}>Fraction of the cost compared to Ethereum and other networks</p>
          </div>
          <div className={styles.featureBox}>
            <div className={styles.featureIconBox}>🎨</div>
            <h4 className={styles.featureHeading}>Pro Tools</h4>
            <p className={styles.featureText}>Advanced creation tools for both AI and digital painting</p>
          </div>
          <div className={styles.featureBox}>
            <div className={styles.featureIconBox}>🛡️</div>
            <h4 className={styles.featureHeading}>Verified Provenance</h4>
            <p className={styles.featureText}>Every NFT includes cryptographic proof of authenticity</p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaContent}>
          <div className={styles.ctaText}>
            <h2 className={styles.ctaTitle}>Ready to Create Authentic NFTs?</h2>
            <p className={styles.ctaSubtitle}>
              Join the future of digital art with blockchain-verified authenticity, 
              decentralized identity, and permanent provenance.
            </p>
          </div>
          <div className={styles.ctaActions}>
            <Link href="/create-select" className={styles.ctaPrimary}>
              <span>Start Creating Now</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </Link>
            <Link href="/marketplace" className={styles.ctaSecondary}>
              Explore Marketplace
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
