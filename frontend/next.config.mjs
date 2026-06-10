/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ".nosync" keeps iCloud Drive from syncing the build dir — iCloud's
  // conflict copies ("server 2", "static 2") corrupt the dev cache otherwise.
  // Only use it locally (Vercel/CI have no iCloud and expect the default).
  distDir: process.env.VERCEL || process.env.CI ? ".next" : ".next.nosync",
};

export default nextConfig;
