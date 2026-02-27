/**
 * API Endpoint: Register New DID (Solana)
 * 
 * DID registration on Solana happens client-side as part of the atomic mint tx.
 * The register_did instruction is built client-side in solanaDID.js and
 * bundled into the mint transaction.
 * 
 * This endpoint is kept for backward compatibility but returns a message
 * directing callers to use the client-side flow.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    success: false,
    message: 'DID registration on Solana is handled client-side via the register_did instruction in the atomic mint transaction. Use the solanaDID.js buildRegisterDidInstruction() function.',
  });
}
