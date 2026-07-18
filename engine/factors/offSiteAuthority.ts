import type { FactorResult, ParsedPage } from "../types.js";

const AUTHORITATIVE_RE = /\.gov|\.edu|pubmed|ncbi|nih\.gov|sciencedirect|nature\.com|journal/i;
const CREDENTIALS_RE = /\b(Dr\.|PhD|MD|board-certified|professor)\b/;

/**
 * PARTIAL: real off-site authority (third-party mentions, YouTube, Reddit) needs
 * external data — Profound + last30days in production mode. Offline we score the
 * on-page proxies of an authoritative brand.
 */
export function offSiteAuthority(page: ParsedPage): FactorResult {
  const evidence: string[] = [];
  let score = 0;

  if (page.author) {
    score += 25;
    evidence.push(`named author: ${page.author}`);
    const text = page.sections.flatMap((s) => s.paragraphs).join(" ");
    if (CREDENTIALS_RE.test(page.author) || CREDENTIALS_RE.test(text)) {
      score += 15;
      evidence.push("author credentials present");
    }
  } else {
    evidence.push("no named author");
  }

  const sameAs = page.sameAsLinks.slice(0, 3);
  score += sameAs.length * 10;
  if (sameAs.length) evidence.push(`schema sameAs profiles: ${sameAs.join(", ")}`);

  const authLinks = page.outboundLinks.filter((l) => AUTHORITATIVE_RE.test(l.href)).slice(0, 3);
  score += authLinks.length * 10;
  if (authLinks.length) evidence.push(`outbound links to authoritative sources: ${authLinks.map((l) => l.href).join(", ")}`);

  return {
    key: "offSiteAuthority",
    name: "Off-site brand authority (proxied on-page)",
    score: Math.min(100, score),
    evidence,
    reasoning: "Ahrefs 2026 factor #1 is third-party brand presence (YouTube above all). Offline proxy only; production mode measures the real thing via Profound.",
    partial: true,
  };
}
