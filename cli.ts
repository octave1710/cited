import { readFileSync } from "node:fs";
import { parse, audit, FACTORS, GATE_FACTOR } from "./engine/index.js";

const [cmd, file, rankArg] = process.argv.slice(2);
if (cmd !== "audit" || !file) {
  console.log("Usage: npm run audit <page.html> [googleRank]");
  process.exit(1);
}

const page = parse(readFileSync(file, "utf8"));
const result = audit(page, { googleRank: rankArg ? Number(rankArg) : undefined });

const bar = (score: number) => "█".repeat(Math.round(score / 5)).padEnd(20, "░");

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
