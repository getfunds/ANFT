/**
 * API endpoint for marketplace listings
 *
 * GET: Reads active listings from on-chain Listing PDAs.
 * POST: No longer needed — listing is signed client-side via wallet adapter.
 */

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { offset = 0, limit = 20, filter, sort } = req.query;

      console.log('📋 API: Fetching on-chain marketplace listings...', { offset, limit, filter, sort });

      let listings = [];

      try {
        const { getActiveListings } = await import('../../../utils/marketplace');
        listings = await getActiveListings();
        console.log(`✅ Found ${listings.length} active listings on-chain`);
      } catch (err) {
        console.warn('⚠️ Could not read on-chain listings:', err.message);
        listings = [];
      }

      // Apply filters
      let filtered = listings;
      if (filter === 'auction') filtered = filtered.filter(l => l.isAuction);
      else if (filter === 'fixed') filtered = filtered.filter(l => !l.isAuction);

      // Apply sorting
      if (sort === 'price-low') filtered.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      else if (sort === 'price-high') filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      else if (sort === 'oldest') filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      else filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const start = parseInt(offset);
      const end = start + parseInt(limit);

      res.status(200).json({
        success: true,
        listings: filtered.slice(start, end),
        total: filtered.length,
        offset: start,
        limit: parseInt(limit),
      });

    } else if (req.method === 'POST') {
      // Listing creation is now handled entirely client-side via the Anchor program.
      res.status(200).json({
        success: false,
        message: 'Listing creation is handled client-side via wallet signing. Use the marketplace.js createMarketplaceListing function.',
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('❌ API Error in /marketplace/listings:', error);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
}
