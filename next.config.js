/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: false, // Disable Next.js compression to avoid conflicts with Hostinger/LiteSpeed
  reactStrictMode: true,

  // Expose environment variables to server runtime
  // Required for Hostinger Node.js hosting to read env vars at runtime
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    ADMIN_SECRET: process.env.ADMIN_SECRET,
  },


  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize cheerio to avoid bundling issues
      config.externals = config.externals || [];
      if (typeof config.externals === 'object' && !Array.isArray(config.externals)) {
        config.externals = [config.externals];
      }
      config.externals.push({
        cheerio: 'commonjs cheerio',
      });
    }
    return config;
  },
}

module.exports = nextConfig
