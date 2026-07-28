/** @type {import('next').NextConfig} */
const nextConfig = {
  // engine/ and adapters/ are plain TS libs outside app/, transpiled as part of the app
  // playwright is loaded by dynamic import at request time and must not be bundled
  serverExternalPackages: ["cheerio", "playwright"],
  // this repo runs TypeScript 7, which no longer exposes the legacy compiler API Next reads
  experimental: { useTypeScriptCli: true },
  devIndicators: false,
};

export default nextConfig;
