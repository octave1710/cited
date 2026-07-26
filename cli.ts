import { readFileSync } from "node:fs";
import { parse, audit, generateFixes, generateSchemas, FACTORS, GATE_FACTOR } from "./engine/index";
import { getLLM } from "./adapters/llm";
import { fanout, userQueries } from "./querylab/fanout";
import { toLabDoc } from "./querylab/detect";
import { runLab } from "./querylab/run";

try {
  process.loadEnvFile(); // .env is optional; env vars already set win over it
} catch {}

const [cmd, file, ...rest] = process.argv.slice(2);
if (!["audit", "fixes", "schema", "querylab"].includes(cmd) || !file) {
  console.log("Usage: tsx cli.ts <audit|fixes|schema> <page.html> [googleRank]");
  console.log('       tsx cli.ts querylab <target.html> <competitor.html> <competitor.html> --topic "..." [--queries "q1;q2;..."]');
  process.exit(1);
}
const rankArg = cmd === "audit" ? rest[0] : undefined;

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

if (cmd === "querylab") {
  const [c1, c2] = rest; // positional: competitors come right after the target
  const flag = (name: string) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const topic = flag("topic");
  const queriesArg = flag("queries");
  if (!c1 || !c2 || (!topic && !queriesArg)) {
    console.log('querylab needs 2 competitor files and --topic "..." (or --queries "q1;q2;...")');
    process.exit(1);
  }
  const queries = queriesArg ? userQueries(queriesArg.split(";")) : fanout(topic!);
  const target = toLabDoc(file, page);
  const competitors = [c1, c2].map((f) => toLabDoc(f, parse(readFileSync(f, "utf8"))));
  const llm = getLLM();

  const STATUS_ICON = { cited: "✅ CITED", paraphrased: "◐ PARAPHRASED (used without credit)", absent: "✗ ABSENT" };
  runLab(target, competitors, queries, llm).then((run) => {
    console.log(`\nCITED Query Lab — ${target.title}`);
    console.log(`engine: ${run.llm} · vs ${competitors.map((c) => c.title).join(" · ")}`);
    console.log("─".repeat(72));
    for (const v of run.verdicts) {
      console.log(`\n"${v.query.text}" (${v.query.source})`);
      console.log(`  ${STATUS_ICON[v.status]}`);
      if (v.citedDocs.length) console.log(`  engine cited: ${v.citedDocs.join(", ")}`);
      if (v.status === "paraphrased") console.log(`  our facts in the answer, uncredited: ${v.matchedMarkers.join(", ")}`);
    }
    console.log(`\n${"─".repeat(72)}\nTARGET CITED: ${run.citedCount}/${run.total} queries\n`);
  });
}
