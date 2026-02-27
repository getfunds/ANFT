/**
 * API endpoint for marketplace offers
 *
 * All offer creation, acceptance, and cancellation is now handled
 * client-side via the Anchor program (wallet signing).
 * This endpoint is kept as a lightweight info endpoint.
 */

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Offer reads could be done client-side via getProgramAccounts.
      // This endpoint exists for backwards compatibility.
      res.status(200).json({
        success: true,
        offers: [],
        total: 0,
        message: 'Offers are read directly from on-chain Offer PDAs via the client.',
      });

    } else if (req.method === 'POST') {
      // All offer actions (create, accept) are signed client-side.
      res.status(200).json({
        success: false,
        message: 'Offer operations are handled client-side via wallet signing. Use marketplace.js makeOffer / acceptOffer.',
      });

    } else if (req.method === 'DELETE') {
      // Offer cancellation is signed client-side.
      res.status(200).json({
        success: false,
        message: 'Offer cancellation is handled client-side via wallet signing. Use marketplace.js cancelOffer.',
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('❌ API Error in /marketplace/offers:', error);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
}
