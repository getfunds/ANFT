/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_ANFT_PROGRAM_ID: process.env.NEXT_PUBLIC_ANFT_PROGRAM_ID,
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    NEXT_PUBLIC_SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
    NEXT_PUBLIC_ANFT_AUTHORITY_PUBKEY: process.env.NEXT_PUBLIC_ANFT_AUTHORITY_PUBKEY,
    NEXT_PUBLIC_ANFT_SAS_SCHEMA_ID: process.env.NEXT_PUBLIC_ANFT_SAS_SCHEMA_ID,
    NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID: process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID,
    NEXT_PUBLIC_HUGGING_FACE_API_KEY: process.env.NEXT_PUBLIC_HUGGING_FACE_API_KEY,
  },
  images: {
    domains: ['gateway.pinata.cloud', 'api-inference.huggingface.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
        port: '',
        pathname: '/ipfs/**',
      }
    ],
    dangerouslyAllowSVG: true,
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Fix for wallet-adapter and Solana dependencies
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        buffer: false,
        fs: false,
        net: false,
        tls: false,
      };
    } else {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Ignore node-specific modules
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    return config;
  },
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
