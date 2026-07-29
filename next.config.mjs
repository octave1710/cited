/** @type {import('next').NextConfig} */
const nextConfig = {
  // engine/ and adapters/ are plain TS libs outside app/, transpiled as part of the app
  // playwright is loaded by dynamic import at request time and must not be bundled
  serverExternalPackages: ["cheerio", "playwright"],
  // this repo runs TypeScript 7, which no longer exposes the legacy compiler API Next reads
  experimental: { useTypeScriptCli: true },
  /**
   * The fixtures are read at runtime through a computed path, which the build tracer
   * cannot see, so without this the hosted build ships without them and the recorded
   * panel 404s. That is the one path that has to work when no API key is present.
   */
  outputFileTracingIncludes: {
    "/api/panel/recorded": ["./fixtures/engines/**"],
    "/api/panel": ["./fixtures/engines/**"],
    "/api/pipeline": ["./fixtures/**"],
    "/api/runs/stream": ["./fixtures/pages/**"],
  },
  devIndicators: false,
};

export default nextConfig;
