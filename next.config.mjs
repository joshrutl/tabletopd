/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The search route reads this file with fs at runtime, which the file tracer
  // can't always see. Without this, Vercel's serverless bundle omits it.
  outputFileTracingIncludes: {
    "/api/bgg/search": ["./data/boardgames_ranks.csv"],
  },
  // Box art is rendered with plain <img> tags (no Next image optimizer), but these
  // hosts stay allowed in case next/image is used for them later.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cf.geekdo-images.com" },
      { protocol: "https", hostname: "**.geekdo-images.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
};

export default nextConfig;
