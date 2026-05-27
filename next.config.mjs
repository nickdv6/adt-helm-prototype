/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep better-sqlite3 as a runtime require, not webpack-bundled (native binding)
  serverExternalPackages: ['better-sqlite3'],

  // Vercel/Next traces dependencies and bundles them into serverless functions.
  // Our SQLite file (data/helm.db) is opened at runtime via fs and isn't traced
  // as a dependency — explicitly include it so it's bundled with every function.
  experimental: {
    outputFileTracingIncludes: {
      '/**/*': ['./data/**/*'],
    },
  },

  // Prototype — don't block deploys on lint or strict TS errors. We'll
  // tighten this when the prototype transitions to production code.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
