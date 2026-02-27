/**
 * API Route: Check NFT approval for marketplace.
 *
 * On Solana, there is no ERC-721 "approval" concept. Instead, the NFT
 * is transferred into an escrow PDA during listing. This endpoint
 * always returns isApproved: true to keep the ListNFTModal flow working.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // On Solana, the NFT transfer to escrow happens atomically in the
  // listNft instruction — no separate approval step is needed.
  return res.status(200).json({
    success: true,
    isApproved: true,
    status: 'No approval needed on Solana — NFT is transferred to escrow during listing.',
  });
}
