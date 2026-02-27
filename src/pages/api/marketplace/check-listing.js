/**
 * API Route: Check if an NFT is currently listed on the marketplace.
 * Reads the on-chain Listing PDA for the given NFT mint.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenAddress } = req.query;

  if (!tokenAddress) {
    return res.status(400).json({ success: false, error: 'Missing tokenAddress query parameter' });
  }

  try {
    const { checkListingStatus } = await import('../../../utils/marketplace');
    const result = await checkListingStatus(tokenAddress);

    return res.status(200).json({
      success: true,
      isListed: result.isListed,
      listing: result.listing || null,
    });
  } catch (error) {
    console.error('Error checking listing status:', error);
    return res.status(200).json({
      success: true,
      isListed: false,
      listing: null,
    });
  }
}
