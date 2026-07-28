import { describe, expect, it, vi } from "vitest";

/**
 * The browser route exists to get past servers that refuse automated readers. It must
 * never become a way past the SSRF boundary: a host that was refused for pointing at a
 * private address has to stay refused, not get a second attempt in Chrome.
 */

// a public IP literal, so assertPublicHost returns without a DNS lookup: on this
// machine example.com resolves to 127.0.0.1 and every case failed for the wrong reason
const rendered = vi.fn(async () => ({
  html: "<html><body>rendered</body></html>",
  finalUrl: "https://93.184.216.34/",
  status: 200,
  bytes: 34,
  fetchedAt: "2026-01-01T00:00:00.000Z",
  source: "live" as const,
  route: "browser" as const,
}));

vi.mock("./render", () => ({
  renderPage: (...args: unknown[]) => rendered(...(args as [])),
  renderText: async () => {
    throw new Error("not used here");
  },
}));

const { fetchPage, IngestError } = await import("./ingest");

describe("fetchPage browser fallback", () => {
  it("never retries a host refused by the SSRF guard", async () => {
    rendered.mockClear();
    await expect(fetchPage("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(/private|loopback|refused/i);
    expect(rendered).not.toHaveBeenCalled();
  });

  it("never retries a host that resolves to a private address", async () => {
    rendered.mockClear();
    await expect(fetchPage("http://localhost:9999/")).rejects.toThrow(/private|loopback|refused/i);
    expect(rendered).not.toHaveBeenCalled();
  });

  it("never retries a URL that is not http or https", async () => {
    rendered.mockClear();
    await expect(fetchPage("file:///etc/passwd")).rejects.toThrow(/http and https/i);
    expect(rendered).not.toHaveBeenCalled();
  });

  it("does not fall back when the caller forbids it", async () => {
    rendered.mockClear();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("no", { status: 403 })) as typeof fetch;
    try {
      await expect(fetchPage("https://93.184.216.34/", { allowBrowser: false })).rejects.toBeInstanceOf(IngestError);
      expect(rendered).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("falls back when the server refuses the crawler, and marks the route", async () => {
    rendered.mockClear();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("forbidden", { status: 403 })) as typeof fetch;
    try {
      const page = await fetchPage("https://93.184.216.34/");
      expect(page.route).toBe("browser");
      expect(rendered).toHaveBeenCalledOnce();
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("marks a plain successful fetch as the crawler route", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("<html><body>hello</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as typeof fetch;
    try {
      const page = await fetchPage("https://93.184.216.34/");
      expect(page.route).toBe("crawler");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
