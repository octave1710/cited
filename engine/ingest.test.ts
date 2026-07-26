import { describe, expect, it } from "vitest";
import { IngestError, isPrivateHost, normaliseUrl } from "./ingest";

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
