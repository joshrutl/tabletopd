/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The search route reads this file with fs at runtime, which the file tracer
  // can't always see. Without this, Vercel's serverless bundle omits it.
  outputFileTracingIncludes: {
    "/api/bgg/search": ["./data/boardgames_ranks.csv"],
  },
  // BGG box art is served from its image CDN.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cf.geekdo-images.com" },
      { protocol: "https", hostname: "**.geekdo-images.com" },
    ],
  },
};

export default nextConfig;
