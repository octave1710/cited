import type { Fix } from "./fixes";
import type { ParsedPage } from "./types";

/**
 * Applies the fix plan to the raw HTML.
 *
 * Two classes of fix. Structural ones (heading phrasing, dates) are applied
 * automatically because they invent nothing. Substantive ones (a figure, a source,
 * a named author) are applied ONLY from values the client supplied. Nothing here
 * ever fabricates a fact; an unsupplied slot leaves the page unchanged and is
 * reported back so the UI can say what was skipped and why.
 */

export interface SuppliedFacts {
  /** Replacement sentences keyed by the exact original sentence they replace. */
  claims?: { find: string; replace: string }[];
  /** A real named author with credentials. */
  author?: { name: string; credential?: string; url?: string };
  /** A real attributed quote to insert after the first section heading. */
  quote?: { text: string; name: string; credential?: string };
}

export interface ApplyResult {
  html: string;
  applied: { title: string; how: string }[];
  skipped: { title: string; why: string }[];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The fix plan quotes the original sentence for display, so `before` arrives wrapped in
 * quotation marks that are not in the page. Anything matching against the real HTML has
 * to strip them first, and exporting it keeps the fact sheet and the applier agreeing.
 */
export const unquote = (s: string) => /^"(.*)"$/s.exec(s)?.[1] ?? s;

function replaceHeading(html: string, from: string, to: string): { html: string; ok: boolean } {
  const re = new RegExp(`(<h[1-6][^>]*>)\\s*${esc(from)}\\s*(</h[1-6]>)`, "i");
  if (!re.test(html)) return { html, ok: false };
  return { html: html.replace(re, `$1${to}$2`), ok: true };
}

export function applyFixes(
  html: string,
  page: ParsedPage,
  fixes: Fix[],
  supplied: SuppliedFacts = {},
  now = new Date(),
): ApplyResult {
  let out = html;
  const applied: ApplyResult["applied"] = [];
  const skipped: ApplyResult["skipped"] = [];
  const today = now.toISOString().slice(0, 10);

  for (const fix of fixes) {
    // ---- heading rephrasing: structural, safe to automate
    if (fix.factorKey === "answerStructure" && fix.title.startsWith("Rephrase heading")) {
      const from = /H[1-6]: "(.+)"/.exec(fix.before)?.[1];
      const to = /H[1-6]: "(.+)"/.exec(fix.after)?.[1];
      if (from && to) {
        const r = replaceHeading(out, from, to);
        if (r.ok) {
          out = r.html;
          applied.push({ title: fix.title, how: `"${from}" → "${to}"` });
        } else {
          skipped.push({ title: fix.title, why: "heading not found in the source HTML" });
        }
      }
      continue;
    }

    // ---- freshness: a date is a fact about the document itself, not an invented claim
    if (fix.factorKey === "freshness") {
      const before = out;
      if (/"dateModified"\s*:\s*"[^"]*"/.test(out)) {
        out = out.replace(/"dateModified"\s*:\s*"[^"]*"/, `"dateModified": "${today}"`);
      } else if (/"datePublished"\s*:\s*"([^"]*)"/.test(out)) {
        out = out.replace(/("datePublished"\s*:\s*"[^"]*")/, `$1,\n    "dateModified": "${today}"`);
      }
      out = out.replace(/(<article[^>]*>)/i, `$1\n    <p>Last verified ${today}.</p>`);
      applied.push({ title: fix.title, how: `dateModified set to ${today}, visible verification line added` });
      if (before === out) skipped.push({ title: fix.title, why: "no JSON-LD or <article> to anchor the date to" });
      continue;
    }

    // ---- author: only from a real supplied name
    if (fix.factorKey === "offSiteAuthority") {
      if (!supplied.author?.name) {
        skipped.push({ title: fix.title, why: "needs a real named author; CITED will not invent one" });
        continue;
      }
      const a = supplied.author;
      const cred = a.credential ? `, ${a.credential}` : "";
      out = out.replace(/(<\/article>)/i, `  <p>Written by ${a.name}${cred}.</p>\n$1`);
      out = out.replace(
        /("headline"\s*:\s*"[^"]*")/,
        `$1,\n    "author": { "@type": "Person", "name": ${JSON.stringify(a.name)}${
          a.url ? `, "sameAs": [${JSON.stringify(a.url)}]` : ""
        } }`,
      );
      applied.push({ title: fix.title, how: `byline and JSON-LD author set to ${a.name} (supplied)` });
      continue;
    }

    // ---- figures: only from supplied, sourced sentences
    if (fix.factorKey === "factualSpecificity") {
      const original = unquote(fix.before);
      const match = supplied.claims?.find((c) => original.includes(c.find) || c.find.includes(original.slice(0, 40)));
      if (!match) {
        skipped.push({ title: fix.title, why: "needs a sourced figure; the slot stays empty until supplied" });
        continue;
      }
      if (out.includes(match.find)) {
        out = out.replace(match.find, match.replace);
        applied.push({ title: fix.title, how: "hedge replaced with the supplied sourced figure" });
      } else {
        skipped.push({ title: fix.title, why: "original sentence not found in the source HTML" });
      }
      continue;
    }

    // ---- attributed quote: only from a supplied real person
    if (fix.factorKey === "sourcedQuotes") {
      if (!supplied.quote?.text || !supplied.quote.name) {
        skipped.push({ title: fix.title, why: "needs a real attributed quote; CITED will not fabricate an expert" });
        continue;
      }
      const q = supplied.quote;
      const cred = q.credential ? `, ${q.credential}` : "";
      const block = `\n    <blockquote>"${q.text}," says ${q.name}${cred}.</blockquote>`;
      const firstH2 = /<\/h2>/i.exec(out);
      if (firstH2) {
        const at = firstH2.index + firstH2[0].length;
        out = out.slice(0, at) + block + out.slice(at);
        applied.push({ title: fix.title, how: `quote attributed to ${q.name} (supplied) inserted` });
      } else {
        skipped.push({ title: fix.title, why: "no H2 to anchor the quote to" });
      }
      continue;
    }

    skipped.push({ title: fix.title, why: "not auto-applicable, needs a human edit" });
  }

  void page;
  return { html: out, applied, skipped };
}
