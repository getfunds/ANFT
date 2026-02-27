## ANFT Pitch Deck
[View ANFT Pitch Deck](https://drive.google.com/file/d/1-ZKzKpsl1CSyXSL95NwcK6nH1_HJMbKu/view)

---

# ANFT — Authentic NFT Platform

[![Built on Solana](https://img.shields.io/badge/Built%20on-Solana-9945FF.svg)](https://solana.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org/)
[![Anchor](https://img.shields.io/badge/Anchor-0.30-blue.svg)](https://www.anchor-lang.com/)

---

## Table of Contents

1. [What Is ANFT](#1-what-is-anft)
2. [The Problem We Are Solving](#2-the-problem-we-are-solving)
3. [How We Solve It and Why It Matters](#3-how-we-solve-it-and-why-it-matters)
4. [Key Pages and Features](#4-key-pages-and-features)
5. [Technical Documentation](#5-technical-documentation)
6. [Authenticity Manifesto](#6-authenticity-manifesto)

---

## 1. What Is ANFT

ANFT (Authentic NFT) is an NFT platform on Solana where artists create, prove, and trade authentic digital artwork.

The platform gives creators two ways to make art — text-to-image generation using open-source AI models, and a full digital painting studio with professional brushes, layers, and textures. Both paths produce the same thing: a real Solana SPL token with an immutable on-chain attestation that permanently records who made the artwork, when, and how.

Every artist on ANFT gets a Decentralized Identity (DID) stored on-chain. Every artwork is fingerprinted with SHA-256 content hashes. Every mint produces a Solana Attestation Service (SAS) record that anyone can verify independently.

---

## 2. The Problem We Are Solving

Digital art has a provenance problem.

When you see an NFT on most platforms, you cannot answer basic questions: Did the person who minted this actually create it? Was the image modified after minting? Is the metadata the same as what was originally uploaded? Has this same image been minted before under a different name?

Most NFT platforms treat minting as a file upload with a price tag. The token points to a URL. The URL points to a JSON file. The JSON file points to an image. None of these connections are cryptographically verified. The creator's identity is just a wallet address — anonymous, disposable, and transferable. There is no record of the creative process, no fingerprint of the original file, and no way to prove the artwork hasn't been tampered with after the fact.

This means:

- **Collectors cannot verify authenticity.** A buyer has no way to confirm that the seller is the original creator, or that the artwork is the same file that was originally minted.
- **Artists cannot prove authorship.** A creator who makes original work has the same on-chain footprint as someone who right-clicks and re-uploads stolen art.
- **Provenance is an afterthought.** Most metadata is stored off-chain with no integrity checks. If the hosting service changes the file, no one would know.

The result is a trust gap between creators and collectors that weakens the entire NFT art ecosystem.

---

## 3. How We Solve It and Why It Matters

ANFT closes the trust gap with a three-layer authenticity system that operates entirely on Solana. Each layer addresses a specific weakness in existing NFT platforms.

### Layer 1: Decentralized Identity (DID)

Every creator registers an on-chain identity before minting. The `anft_did` Anchor program stores a `DidProfile` PDA on Solana with the creator's chosen username, wallet address, creation timestamp, and attestation count. The DID format is `did:anft:<pda_address>`.

This is not a display name in a database. It is a program-owned account on Solana that cannot be forged, duplicated, or transferred without the owner's private key. A `WalletLookup` PDA maps wallet addresses to DID profiles, so any wallet can be resolved to its creator identity.

**Why it matters:** When you see an NFT on ANFT, you can look up the creator's DID and see every artwork they have ever attested. Identity is persistent, verifiable, and tied to the blockchain — not to an email address or a social media handle.

### Layer 2: Content Hashing

Before any artwork is uploaded or minted, ANFT computes a canonical content hash:

1. The raw image bytes are hashed with SHA-256 to produce an `imageHash`.
2. The metadata is normalized to canonical JSON (sorted keys, sorted attributes) and hashed to produce a `metadataHash`.
3. The image hash and canonical metadata are combined and hashed again to produce a `contentHash`.

These hashes are computed client-side before upload and recorded in the SAS attestation. They create a unique fingerprint of the artwork at the moment of creation.

**Why it matters:** If someone downloads an artwork, modifies a single pixel, and tries to pass it off as the original, the content hash will not match. If the IPFS file is replaced or corrupted, re-hashing the current file will reveal the discrepancy. The fingerprint is permanent and deterministic.

### Layer 3: On-Chain Attestation (SAS)

Every mint produces a real Solana Attestation Service attestation. The `ANFT_MINT_V1` schema records 13 fields on-chain:

| Field | Description |
|-------|-------------|
| `creatorDID` | Full DID string of the creator |
| `timestamp` | Unix timestamp of creation |
| `network` | Solana network (devnet / mainnet-beta) |
| `platform` | Always "ANFT" |
| `nftName` | Artwork title |
| `nftDescription` | Artwork description |
| `creatorAddress` | Creator's Solana wallet address |
| `imageHash` | SHA-256 hash of the image file |
| `metadataHash` | SHA-256 hash of the metadata JSON |
| `imageCID` | IPFS CID of the image file |
| `metadataCID` | IPFS CID of the metadata JSON |
| `nftMintAddress` | SPL token mint address |
| `royaltyBps` | Royalty in basis points |

The attestation is signed by the ANFT authority keypair (held server-side, never exposed to the client) and written to a deterministic PDA derived from the NFT mint address. 

**Why it matters:** The attestation is an independent, on-chain record that exists separately from the NFT token itself. Even if every off-chain service disappears, the attestation account on Solana still contains the creator DID, the content hashes, and the IPFS CIDs. Anyone with a Solana RPC endpoint can verify it.

### The Marketplace: Real On-Chain Trading

The `anft_marketplace` Anchor program handles all trading operations on-chain:

- **Listing** — The seller's NFT is transferred to an escrow PDA. The listing PDA stores price, expiration, and seller info.
- **Purchasing** — The buyer sends SOL. The program splits payment between the seller and the fee recipient, then transfers the NFT from escrow to the buyer's token account.
- **Offers** — A buyer's SOL is held in an offer escrow PDA. The seller can accept (triggering the same escrow-to-buyer transfer) or the buyer can cancel to reclaim their SOL.
- **Cancellation** — The seller can cancel an active listing at any time. The NFT returns from escrow to the seller's token account.

All operations use PDA-derived accounts with deterministic seeds (`"listing"`, `"escrow"`, `"offer"`, `"offer_escrow"`). The marketplace PDA stores the admin, fee recipient, fee basis points (default 2.5%), and pause state.

**Why it matters:** There is no off-chain order book, no centralized matching engine, and no custodial wallet holding user funds. Every trade is a Solana transaction that anyone can verify on an explorer.

---

## 4. Key Pages and Features

### Home Page (`/`)

The landing page introduces the platform with a hero section, trust pillars explaining the three-layer authenticity system, creation method overview (AI generation and digital painting), a step-by-step process flow, and a features grid. It links directly to the creation flow and marketplace.

### Creation Method Selection (`/create-select`)

A selection screen where users choose between two creation paths:

- **Prompt-to-Art** — Generate artwork from a text description using open-source AI models.
- **Digital Painting** — Open the full painting studio and create artwork by hand.

Both paths converge at the same minting pipeline: content hashing, IPFS upload, DID verification, Metaplex NFT mint, SAS attestation, and SPL Memo — all bundled into a single atomic transaction.

### AI Art Creation (`/create`)

The generation page connects to Hugging Face Inference Providers. Users enter a text prompt, and the system tries multiple models in sequence (FLUX.1-dev, Stable Diffusion XL, Stable Diffusion 2.1, Stable Diffusion v1.5, OpenJourney v4) until one succeeds. Generated images are displayed in a gallery where the user selects their preferred result.

Before minting, the user fills in the NFT name, description, and royalty percentage. The system validates the prompt for content safety (blocked words, length limits), computes content hashes, uploads to Filebase IPFS, checks for an existing DID (or prompts registration), and then constructs the atomic mint transaction.

Prompts are encrypted and stored as NFT attributes, viewable only by the owner.

### Digital Painting Studio (`/paint`)

A full-featured canvas application running at 2048x2048 resolution with the following tools:

**10 Brush Types:**
- **Pencil** — Thin graphite strokes with paper grain response, elliptical tip rotated in stroke direction
- **Ink Pen** — Crisp uniform strokes at 100% opacity
- **Ballpoint** — Slight waxiness with pressure-dependent width and opacity
- **Flat Brush** — Wide rectangular strokes with angle interpolation for smooth direction changes
- **Round Brush** — Bristle cluster that tapers with pressure; low pressure separates bristles, high pressure creates a solid circle
- **Watercolor** — Translucent radial gradients with edge bloom halos
- **Oil Brush** — Thick impasto strokes with color mixing (samples underlying canvas color)
- **Charcoal** — Rough grainy particles with dust scatter using multiply blending
- **Airbrush** — Soft radial gradient with slow flow buildup
- **Eraser** — Hard or soft removal modes

**Engine:** All brushes use stamp-based rendering with Catmull-Rom spline interpolation for smooth paths. Pressure sensitivity is supported.

**Additional Features:**
- **Layers** — Up to 10 layers with visibility toggle, opacity control, blend modes (Normal, Multiply, Screen, Overlay), rename, duplicate, delete, and drag-to-reorder
- **Color** — HSB color picker with a 20-swatch saveable palette and quick swap between current/previous color
- **Textures** — Procedural paper and canvas textures (generated with fractal Brownian motion noise) that overlay on brush strokes
- **Canvas Controls** — Zoom, pan (spacebar + drag), and rotation (R key + drag)
- **Background** — White, cream, light grey, or transparent canvas options
- **Undo/Redo** — Up to 50 history states
- **Fill Bucket** — Flood fill with tolerance control
- **Eyedropper** — Alt+click to sample canvas color

The studio exports the canvas as a PNG blob, which enters the same minting pipeline as AI-generated artwork.

### Marketplace (`/marketplace`)

Displays all active on-chain listings fetched via `getProgramAccounts` with a filter on the `isActive` byte. Each NFT card shows the artwork image, name, truncated description, token ID, price in SOL, and seller address.

**Buyer actions:**
- **Buy Now** — Sends a `buyNft` transaction through the marketplace program
- **Make Offer** — Deposits SOL into an offer escrow PDA with a configurable amount and duration
- **Place Bid** — For auction-type listings

**Seller actions:**
- **Cancel Listing** — Returns the NFT from escrow to the seller's wallet via the `cancelListing` instruction (available directly on the marketplace card for your own listings)

The page supports search, filtering, sorting, and pagination.

### Profile (`/profile`)

A unified page that combines the user's DID identity and NFT collection. If the connected wallet has a registered DID, it displays the username, DID string, wallet address, member-since date, and total attestation count. Below the profile header, it shows a grid of the user's NFTs with filter tabs (All, Created, Owned).

Each NFT card in the profile includes the ability to check listing status, cancel active listings, view original prompts (for AI-generated art), and list NFTs for sale via the listing modal.

If the wallet has no DID, the page prompts the user to create their first NFT (which triggers automatic DID registration).

### DID Search (`/did`)

A public page where anyone can search for a creator by username or full DID string. Results display the creator's profile and all their attested NFTs, fetched from on-chain SAS attestation records. This page does not require a wallet connection.

### Success Pages

- **Listing Success (`/listing-success`)** — Confirmation after an NFT is listed, showing listing details and links to the marketplace.
- **Purchase Success (`/purchase-success`)** — Confirmation after an NFT purchase, showing transaction ID with a link to Solana Explorer.

---

## 5. Technical Documentation

### Architecture Overview

```
Browser (Next.js React App)
├── Wallet Adapter (Phantom / Solflare / Backpack)
├── Creation Pages (/create, /paint)
│   ├── AI: Hugging Face Inference Providers API
│   └── Paint: Canvas 2D with stamp-based brush engine
├── Minting Pipeline
│   ├── Content Hashing (SHA-256, client-side)
│   ├── IPFS Upload (Filebase via API routes)
│   ├── DID Check / Registration (anft_did Anchor program)
│   ├── Metaplex NFT Mint (SPL Token + Token Metadata)
│   ├── SAS Attestation (server-side authority signing)
│   └── SPL Memo (human-readable tx annotation)
├── Marketplace (/marketplace)
│   └── anft_marketplace Anchor program (list, buy, offer, cancel)
└── Profile (/profile, /did)
    └── DID resolution + SAS attestation queries
```

### On-Chain Programs

#### `anft_did` — Creator Identity Program

- **Program ID:** `HuvfZBXs4mP3RnJQxcDPL2nbV52dn51S5yQEKaD833op`
- **Framework:** Anchor 0.30

**Instructions:**
| Instruction | Description |
|---|---|
| `register_did(username)` | Creates a `DidProfile` PDA and `WalletLookup` PDA for the signer |
| `increment_attestation_count()` | Increments the attestation counter on a `DidProfile` |

**PDA Seeds:**
| Account | Seeds |
|---|---|
| `DidProfile` | `["did", username]` |
| `WalletLookup` | `["wallet-did", wallet_pubkey]` |

**Account Structure — `DidProfile`:**
| Field | Type | Description |
|---|---|---|
| `did` | `String` | Full DID string `did:anft:<pda>` |
| `username` | `String` | Chosen username (3–32 chars, lowercase alphanumeric + hyphens) |
| `pda_address` | `Pubkey` | Self-referencing PDA address |
| `current_wallet` | `Pubkey` | Current owner wallet |
| `original_wallet` | `Pubkey` | Original registration wallet |
| `created_at` | `i64` | Unix timestamp |
| `attestation_count` | `u64` | Number of SAS attestations made |
| `bump` | `u8` | PDA bump seed |

#### `anft_marketplace` — NFT Trading Program

- **Program ID:** `8fpA4QsK2kwNd9JxqXd2S23FsspmFiKStmKYNBzGE8bK`
- **Framework:** Anchor 0.30

**Instructions:**
| Instruction | Arguments | Description |
|---|---|---|
| `initialize_marketplace` | `fee_bps: u16` | Creates the global marketplace PDA. Admin sets fee (max 10%). |
| `list_nft` | `price: u64, duration: i64, is_auction: bool` | Transfers NFT to escrow PDA, creates listing PDA. Min duration: 24h. |
| `buy_nft` | — | Buyer sends SOL; program splits to seller + fee recipient; NFT transfers from escrow to buyer. |
| `cancel_listing` | — | Returns NFT from escrow to seller. |
| `make_offer` | `amount: u64, duration: i64` | Deposits SOL into offer escrow PDA. |
| `cancel_offer` | — | Returns SOL from offer escrow to offerer. |
| `accept_offer` | — | Seller accepts; SOL goes to seller (minus fee); NFT goes to offerer. |
| `update_price` | `new_price: u64` | Seller updates listing price. |
| `pause_marketplace` | — | Admin pauses all trading. |
| `unpause_marketplace` | — | Admin unpauses trading. |
| `update_fee` | `new_fee_bps: u16` | Admin updates fee percentage. |
| `update_fee_recipient` | — | Admin changes fee recipient wallet. |
| `emergency_withdraw` | — | Admin withdraws excess SOL. |

**PDA Seeds:**
| Account | Seeds |
|---|---|
| `Marketplace` | `["marketplace"]` |
| `Listing` | `["listing", nft_mint]` |
| `Escrow` | `["escrow", nft_mint]` |
| `Offer` | `["offer", nft_mint, offerer]` |
| `OfferEscrow` | `["offer_escrow", nft_mint, offerer]` |

**Account Structure — `Marketplace`:**
| Field | Type | Description |
|---|---|---|
| `admin` | `Pubkey` | Marketplace administrator |
| `fee_recipient` | `Pubkey` | Wallet that receives fees |
| `fee_bps` | `u16` | Fee in basis points (250 = 2.5%) |
| `paused` | `bool` | Whether trading is halted |
| `listing_count` | `u64` | Total listings created |
| `bump` | `u8` | PDA bump seed |

**Account Structure — `Listing`:**
| Field | Type | Description |
|---|---|---|
| `seller` | `Pubkey` | Seller's wallet |
| `nft_mint` | `Pubkey` | SPL token mint address |
| `price` | `u64` | Price in lamports |
| `expiration_time` | `i64` | Unix expiration timestamp |
| `is_active` | `bool` | Whether listing is live |
| `is_auction` | `bool` | Whether listing is an auction |
| `highest_bid` | `u64` | Current highest bid (lamports) |
| `highest_bidder` | `Pubkey` | Current highest bidder |
| `created_at` | `i64` | Listing creation timestamp |
| `bump` | `u8` | PDA bump seed |

**Events Emitted:**
`MarketplaceInitialized`, `ListingCreated`, `ListingCancelled`, `NftPurchased`, `OfferCreated`, `OfferCancelled`, `OfferAccepted`, `PriceUpdated`, `MarketplacePausedEvent`, `FeeUpdated`, `FeeRecipientUpdated`

#### Solana Attestation Service (SAS)

- **SAS Program:** `22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG`
- **Schema PDA:** `BB7Wr9GDMS9KHdw7uKU2fo6iSkgmLfY1nZokFm5ncggY`
- **Credential PDA:** `2XRrqD6AFZFcUjC8TKaLxJnFbMfZNk9iYksB7RnL3b32`
- **Authority:** `Gyeu1n6z7sXaT32WHTUxpGipukXCewKw3rRxNKtaiofg`
- **Schema Name:** `ANFT_MINT_V1`
- **Library:** `sas-lib` v1.0.10 (uses `@solana/kit` v5)

The authority keypair is stored server-side only (`ANFT_AUTHORITY_KEYPAIR` env var). Client-side code sends attestation data to `/api/attestation/create`, which signs and submits the SAS transaction. The attestation PDA is derived from the credential, schema, and a nonce (the NFT mint address), making each attestation deterministic and unique per NFT.

### Atomic Minting Transaction

When an artist mints an NFT, all of the following happen in a single Solana transaction:

1. **`register_did`** (if first mint) — Creates the artist's on-chain identity
2. **Metaplex SPL Token Mint** — Creates the mint account, initializes it, creates the associated token account, mints 1 token, and creates the Metaplex metadata account
3. **SAS Attestation** — Created server-side via the authority keypair (a separate transaction, but triggered atomically in the workflow)
4. **`increment_attestation_count`** — Updates the DID profile's attestation counter
5. **SPL Memo** — Attaches human-readable JSON to the transaction (attestation address, creator DID, NFT mint, name, network, timestamp)

If any step fails, the on-chain transaction reverts. The SAS attestation is created server-side as a separate transaction signed by the authority.

### API Routes

| Route | Method | Description |
|---|---|---|
| `/api/attestation/create` | POST | Creates a real on-chain SAS attestation. Body: attestation payload. Returns: attestation address. |
| `/api/attestation/list` | GET | Fetches all SAS attestations for a DID. Query: `?did=did:anft:<pda>`. Returns: array of decoded attestations. |
| `/api/attestation/verify` | GET | Verifies a SAS attestation by address. Query: `?address=<pda>`. Returns: verification result with decoded data. |
| `/api/nft/prepare-mint` | POST | Prepares Metaplex mint instructions for client-side signing. Body: wallet, mint pubkey, name, URI, royalty. Returns: serialized instructions. |
| `/api/did/check` | — | Checks if a wallet has an existing DID. |
| `/api/did/register` | — | Registers a new DID. |
| `/api/did/resolve` | — | Resolves a DID string or username to a profile. |
| `/api/upload-to-ipfs` | POST | Uploads JSON metadata to Filebase IPFS. Returns: IPFS hash and URL. |
| `/api/upload-file-to-filebase` | POST | Uploads a file (base64) to Filebase IPFS. Returns: IPFS hash and URL. |
| `/api/marketplace/listings` | — | Fetches marketplace listings. |
| `/api/marketplace/purchase` | — | Processes a marketplace purchase. |
| `/api/marketplace/check-listing` | — | Checks if an NFT is listed. |
| `/api/marketplace/check-approval` | — | Checks marketplace approval status. |
| `/api/marketplace/offers` | — | Fetches offers for a listing. |

### Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (React) | 15.5.3 (React 19.1.0) |
| **Styling** | CSS Modules | — |
| **Solana SDK** | @solana/web3.js | 1.95.4 |
| **Anchor** | @coral-xyz/anchor | 0.30.1 |
| **SPL Token** | @solana/spl-token | 0.4.9 |
| **Metaplex** | @metaplex-foundation/mpl-token-metadata | — |
| **SAS** | sas-lib + @solana/kit | 1.0.10 / v5 |
| **AI Generation** | @huggingface/inference | 4.12.0 |
| **IPFS** | Filebase (S3-compatible via @aws-sdk/client-s3) | — |
| **Wallets** | Phantom, Solflare, Backpack (direct browser adapters) | — |

### Project Structure

```
ANFT/
├── programs/
│   ├── anft_did/src/lib.rs              # DID Anchor program
│   └── anft_marketplace/src/lib.rs      # Marketplace Anchor program
├── scripts/
│   └── register-sas-schema.js           # One-time SAS schema registration
├── src/
│   ├── app/
│   │   ├── page.js                      # Home / landing page
│   │   ├── layout.js                    # Root layout with wallet providers
│   │   ├── globals.css                  # Design tokens, animations, utilities
│   │   ├── create/page.js              # AI art creation + minting
│   │   ├── create-select/page.js       # Creation method selection
│   │   ├── paint/page.js               # Digital painting studio page
│   │   ├── marketplace/page.js         # NFT marketplace
│   │   ├── profile/page.js             # Unified profile + NFT gallery
│   │   ├── did/page.js                 # Public DID search
│   │   ├── listing-success/page.js     # Listing confirmation
│   │   └── purchase-success/page.js    # Purchase confirmation
│   ├── components/
│   │   ├── Navbar.js                    # Global navigation
│   │   ├── ConnectWalletPrompt.js       # Wallet connection CTA
│   │   ├── DIDProfileView.js            # DID profile display
│   │   ├── DIDRegistrationModal.js      # Username registration wizard
│   │   ├── ListNFTModal.js              # NFT listing form
│   │   ├── DigitalPaintingStudioModern.js  # Full painting canvas app
│   │   └── painting/
│   │       ├── brushes.js               # 10 brush stamp functions + engine
│   │       ├── textures.js              # Procedural paper/canvas textures
│   │       ├── ColorPickerHSB.js        # HSB color picker
│   │       └── LayersPanel.js           # Layer management panel
│   ├── hooks/
│   │   ├── useDID.js                    # DID state management hook
│   │   └── useWalletAdapter.js          # Wallet adapter hook
│   ├── utils/
│   │   ├── solanaNFTMinting.js          # Atomic mint workflow
│   │   ├── solanaDID.js                 # DID PDA derivation + operations
│   │   ├── sasAttestation.js            # SAS attestation client utilities
│   │   ├── solanaWallet.js              # Wallet connection + AnchorProvider
│   │   ├── marketplace.js               # Marketplace PDA operations
│   │   ├── contentHashing.js            # SHA-256 content fingerprinting
│   │   ├── artworkFinalization.js       # Hash + IPFS upload pipeline
│   │   ├── aiImageGeneration.js         # Hugging Face text-to-image
│   │   └── filebaseIPFS.js              # Filebase S3-compatible uploads
│   └── pages/api/                       # Next.js API routes (see table above)
└── sas-schema-metadata.json             # Registered SAS schema definition
```

### Environment Variables

| Variable | Required | Scope | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes | Public | Solana RPC endpoint |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | Yes | Public | `devnet` or `mainnet-beta` |
| `NEXT_PUBLIC_ANFT_PROGRAM_ID` | Yes | Public | `anft_did` program ID |
| `NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID` | Yes | Public | `anft_marketplace` program ID |
| `NEXT_PUBLIC_ANFT_AUTHORITY_PUBKEY` | Yes | Public | SAS authority public key |
| `NEXT_PUBLIC_ANFT_SAS_SCHEMA_ID` | Yes | Public | SAS schema PDA address |
| `ANFT_AUTHORITY_KEYPAIR` | Yes | Server | Base58-encoded authority keypair (never exposed to client) |
| `NEXT_PUBLIC_HUGGING_FACE_API_KEY` | Yes | Public | Hugging Face API token |
| `FILEBASE_ACCESS_KEY` | Yes | Server | Filebase S3 access key |
| `FILEBASE_SECRET_KEY` | Yes | Server | Filebase S3 secret key |
| `FILEBASE_BUCKET` | Yes | Server | Filebase bucket name |

### Setup

```bash
git clone https://github.com/getfunds/ANFT.git
cd ANFT
npm install
cp .env.example .env.local   # Fill in all required values
npm run dev                   # Starts on http://localhost:3000
```

**Prerequisites:** Node.js v20+, a Solana wallet extension (Phantom, Solflare, or Backpack), and devnet SOL for testing.

---

## 6. Authenticity Manifesto

We built ANFT because we believe provenance should be a first-class feature of digital art, not an afterthought.

Every NFT platform says it values creators. Most of them give creators nothing more than a wallet address and a mint button. The artwork's history begins and ends at the moment of upload. There is no record of who actually made it, no fingerprint of the original file, and no way to verify that what you see today is what the artist originally created.

We think that is insufficient.

On ANFT, authenticity is not a marketing word — it is an engineering specification. Every artwork is tied to a real on-chain identity. Every file is cryptographically fingerprinted before it touches IPFS. Every mint produces an immutable attestation record that exists independently of our platform, our servers, and our business.

If ANFT disappeared tomorrow, the attestations would still be on Solana. The DID profiles would still be on Solana. The content hashes would still be in the attestation data. Anyone with a Solana RPC endpoint could reconstruct the complete provenance chain for every NFT ever minted on this platform.

That is the standard we hold ourselves to. Not "trust us" — **verify it yourself**.

---

*ANFT — Where Authenticity Is On-Chain*
