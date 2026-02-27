/**
 * API Route: Marketplace Purchase (Solana)
 *
 * Purchases are executed client-side via the Anchor program's buyNft instruction.
 * The buyer signs the transaction with their wallet adapter.
 * This endpoint is kept for backwards compatibility.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    success: false,
    message: 'Purchases are handled client-side via the Anchor buyNft instruction. Use marketplace.js purchaseNFT.',
    requiresWalletSigning: true,
  });
}
