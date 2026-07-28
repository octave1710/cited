import { afterAll, describe, expect, it } from "vitest";
import { IngestError, assertPublicHost, fetchPage, isPrivateHost, isPrivateIp, normaliseUrl } from "./ingest";

describe("isPrivateHost", () => {
  it("refuses loopback, RFC1918 and link-local targets", () => {
    for (const h of [
      "localhost",
      "127.0.0.1",
      "127.1.2.3",
      "0.0.0.0",
      "10.0.0.5",
      "192.168.1.10",
      "172.16.4.1",
      "172.31.255.255",
      "169.254.169.254", // cloud metadata endpoint
      "::1",
      "[::1]",
      "fd00:1234::1",
      "fe80::1",
      "printer.local",
      "db.internal",
    ]) {
      expect(isPrivateHost(h), h).toBe(true);
    }
  });

  it("allows ordinary public hosts, including lookalikes", () => {
    for (const h of ["example.com", "en.wikipedia.org", "172.32.0.1", "11.0.0.1", "1270.example.com"]) {
      expect(isPrivateHost(h), h).toBe(false);
    }
  });
});

describe("normaliseUrl", () => {
  it("adds https when the scheme is missing", () => {
    expect(normaliseUrl("example.com/page").toString()).toBe("https://example.com/page");
  });

  it("rejects empty, malformed and non-http input", () => {
    expect(() => normaliseUrl("")).toThrow(IngestError);
    expect(() => normaliseUrl("   ")).toThrow(IngestError);
    expect(() => normaliseUrl("javascript:alert(1)")).toThrow(IngestError);
    expect(() => normaliseUrl("file:///etc/passwd")).toThrow(IngestError);
  });

  it("blocks private hosts at the boundary", () => {
    expect(() => normaliseUrl("http://127.0.0.1:3000")).toThrow(/refused/i);
    expect(() => normaliseUrl("http://169.254.169.254/latest/meta-data")).toThrow(/refused/i);
  });
});

describe("isPrivateIp", () => {
  it("catches loopback however the address is spelled", () => {
    for (const ip of ["127.0.0.1", "::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("catches every reserved range, not only RFC1918", () => {
    for (const ip of ["0.0.0.0", "10.1.2.3", "172.20.0.1", "192.168.0.1", "169.254.169.254", "100.64.0.1", "224.0.0.1", "fd00::1", "fe80::1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("lets real public addresses through", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "2606:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});

describe("isPrivateHost, spelling attacks", () => {
  it("refuses the IPv4-mapped IPv6 loopback that the prefix test used to allow", () => {
    for (const h of ["[::ffff:127.0.0.1]", "::ffff:127.0.0.1", "[::ffff:7f00:1]", "[::]"]) {
      expect(isPrivateHost(h), h).toBe(true);
    }
  });

  it("refuses integer and hex spellings of an IPv4 address", () => {
    for (const h of ["2130706433", "0x7f000001"]) {
      expect(isPrivateHost(h), h).toBe(true);
    }
  });
});

/**
 * The redirect guard cannot be exercised against a local server, because the guard
 * correctly refuses to fetch a local server in the first place. So the network is
 * stubbed and the assertion is on our own hop loop: a public first hop that answers
 * 302 towards a private target must never produce a body.
 */
describe("fetchPage follows redirects itself and revalidates every hop", () => {
  const realFetch = globalThis.fetch;
  const stub = (routes: Record<string, { status: number; location?: string; body?: string }>) => {
    globalThis.fetch = (async (input: URL | RequestInfo) => {
      const u = String(input instanceof URL ? input : input instanceof Request ? input.url : input);
      const r = routes[u];
      if (!r) throw new Error(`unstubbed fetch: ${u}`);
      return new Response(r.body ?? "", {
        status: r.status,
        headers: r.location ? { location: r.location } : { "content-type": "text/html" },
      });
    }) as typeof fetch;
  };
  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  // en.wikipedia.org is used purely as a name that really resolves to a public address
  const PUBLIC = "https://en.wikipedia.org/start";

  it("refuses a hop that lands on a private target, however the target is written", async () => {
    for (const target of [
      "http://127.0.0.1:9/secret",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::ffff:127.0.0.1]:9/secret",
      "http://2130706433/secret",
    ]) {
      stub({ [PUBLIC]: { status: 302, location: target } });
      await expect(fetchPage(PUBLIC), target).rejects.toThrow(/refused/i);
    }
  });

  it("refuses a hop that resolves to a private address through DNS", async () => {
    stub({ [PUBLIC]: { status: 302, location: "http://localtest.me/secret" } });
    await expect(fetchPage(PUBLIC)).rejects.toThrow(/private address/i);
  });

  it("stops a redirect loop instead of following it forever", async () => {
    stub({ [PUBLIC]: { status: 302, location: PUBLIC } });
    await expect(fetchPage(PUBLIC)).rejects.toThrow(/redirected more than/i);
  });

  it("still follows an ordinary public redirect to the end", async () => {
    stub({
      [PUBLIC]: { status: 301, location: "https://en.wikipedia.org/final" },
      "https://en.wikipedia.org/final": { status: 200, body: "<html><body>ok</body></html>" },
    });
    const page = await fetchPage(PUBLIC);
    expect(page.status).toBe(200);
    expect(page.html).toContain("ok");
  });
});

describe("assertPublicHost", () => {
  it("refuses a public name whose DNS answer is loopback", async () => {
    // localtest.me publishes an A record pointing at 127.0.0.1
    await expect(assertPublicHost("localtest.me")).rejects.toThrow(/private address/i);
  });

  it("accepts a name that really resolves to a public address", async () => {
    await expect(assertPublicHost("en.wikipedia.org")).resolves.toBeUndefined();
  });
});
