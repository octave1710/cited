import { readFileSync } from "node:fs";
import { parse, audit, generateFixes, generateSchemas, FACTORS, GATE_FACTOR } from "./engine/index.js";

const [cmd, file, rankArg] = process.argv.slice(2);
if (!["audit", "fixes", "schema"].includes(cmd) || !file) {
  console.log("Usage: tsx cli.ts <audit|fixes|schema> <page.html> [googleRank]");
  process.exit(1);
}

const page = parse(readFileSync(file, "utf8"));
const result = audit(page, { googleRank: rankArg ? Number(rankArg) : undefined });
const bar = (score: number) => "█".repeat(Math.round(score / 5)).padEnd(20, "░");

if (cmd === "audit") {
  console.log(`\nCITED audit — ${page.title || file}`);
  console.log("─".repeat(72));
  console.log(`OVERALL ${result.overall}/100  [${result.grade.toUpperCase()}]${result.gated ? "  ⛔ GATED: page not crawlable" : ""}\n`);
  for (const f of result.factors) {
    const cfg = FACTORS.find((c) => c.key === f.key);
    const weight = cfg ? `${(cfg.weight * 100).toFixed(0)}%` : "GATE";
    console.log(`${bar(f.score)} ${String(f.score).padStart(3)}  ${f.name}${f.partial ? " (partial)" : ""}  [${weight}]`);
    console.log(`     source: ${cfg?.source ?? GATE_FACTOR.source}`);
    for (const e of f.evidence) console.log(`     · ${e}`);
    console.log();
  }
  if (result.weakest.length) {
    console.log("FIX FIRST (weighted impact order):");
    result.weakest.forEach((f, i) => console.log(`  ${i + 1}. ${f.name} (${f.score}/100)`));
  }
  console.log();
}

if (cmd === "fixes") {
  const fixes = generateFixes(page, result);
  console.log(`\nCITED fixes — ${page.title || file} (${result.overall}/100)`);
  console.log("─".repeat(72));
  if (!fixes.length) console.log("Nothing to fix above the reporting thresholds.");
  fixes.forEach((f, i) => {
    console.log(`\n${i + 1}. ${f.title}  [impact ${f.impact}/5 · effort ${f.effort}/5 · priority ${f.priority}]`);
    console.log(`   factor: ${f.factorKey}`);
    console.log(`   BEFORE  ${f.before}`);
    console.log(`   AFTER   ${f.after}`);
    console.log(`   why: ${f.rationale}`);
  });
  console.log();
}

if (cmd === "schema") {
  const { blocks, warnings } = generateSchemas(page);
  console.log(`\n<!-- CITED generated JSON-LD for: ${page.title || file} -->`);
  for (const b of blocks) {
    console.log(`<script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n</script>`);
  }
  for (const w of warnings) console.log(`<!-- WARNING: ${w} -->`);
  console.log();
}
