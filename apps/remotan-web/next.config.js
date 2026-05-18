/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@kongila/shared-types",
    "@kongila/database",
    "@kongila/auth",
    "@kongila/workflows",
    "@kongila/matching-engine",
    "@kongila/contracts",
    "@kongila/notifications",
    "@kongila/analytics",
    "@kongila/utils",
    "@kongila/ui"
  ]
};

module.exports = nextConfig;
