import { readFileSync } from "node:fs";
import { extractAll } from "./engines/extract";
import { buildBoard, primaryTarget } from "./engines/board";
import { teardownFromCitations, leadSlots, questionIntent, SKINCARE_BRANDS, sourceClassOf, nameTokenFor, brandNamingTable } from "./engines/why";

const qs = extractAll(JSON.parse(readFileSync("fixtures/engines/vitamin-c-serum-uk.json","utf8")));
const board = buildBoard(qs);
const t = primaryTarget(board)!;
console.log("questions", qs.length, "answersTotal", qs.flatMap(q=>q.answers).length);
const answers = qs.flatMap(q=>q.answers);
console.log("no-citation answers:", answers.filter(a=>!a.citations.length).length);
console.log("  of which truly no answer:", answers.filter(a=>!a.citations.length && a.empty?.includes("returned no answer")).length);
console.log("  of which answered w/o citing:", answers.filter(a=>!a.citations.length && a.empty?.includes("without citing")).length);
console.log("engines with zero citations panel-wide:", ["aiOverview","aiMode","perplexity","chatgpt","gemini"].filter(k=>answers.filter(a=>a.engine===k).every(a=>!a.citations.length)));
const td = teardownFromCitations(board, qs, t.domain);
console.log("\n=== TARGET", t.domain, "===");
console.log(td.headline);
for (const f of td.findings) { console.log("\n["+f.key+"] strength", f.strength); console.log("verdict:", f.verdict); f.evidence.forEach(e=>console.log(" -", e)); }
console.log("\nREPLICABLE"); td.replicable.forEach(x=>console.log(" -", x));
console.log("\nNOT REPLICABLE"); td.notReplicable.forEach(x=>console.log(" -", x));
