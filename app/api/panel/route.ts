import { getLLM } from "../../../adapters/llm";
import { generateQuestions } from "../../../citationmap/questions";
import { runPanel, hasApifyToken } from "../../../engines/run";
import { buildBoard, primaryTarget } from "../../../engines/board";
import { teardownFromCitations } from "../../../engines/why";

export const runtime = "nodejs";
export const maxDuration = 800;

/**
 * Two steps, one stream.
 *
 * 1. The topic becomes a question set. That is a model writing questions, which is a
 *    legitimate use of one: nobody claims these are search volumes, they are the
 *    questions a buyer asks, and they are readable and editable on screen.
 * 2. A panel of those questions is put to FIVE REAL ENGINES and their real citations
 *    come back. This is the part the previous version faked by asking a model what it
 *    would cite, which named one site per question and could not be checked.
 *
 * The panel is a subset on purpose. Every question costs about 2.7 cents across the
 * five engines and roughly ten seconds of wall clock, so asking all 160 would cost
 * four dollars and take most of an hour. The screen says exactly how many were asked.
 */

interface Body {
  topic?: string;
  market?: string;
  brandDomain?: string;
  /** How many questions to generate per buying angle. Eight angles. */
  perIntent?: number;
  /** How many of them to actually put to the engines. */
  panelSize?: number;
  /** Skip generation and use these exact questions. */
  questions?: string[];
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }

  const topic = (body.topic ?? "").trim();
  if (!topic) return Response.json({ error: "Give a topic to map." }, { status: 400 });
  const market = (body.market ?? "UK").trim();
  const brandDomain = (body.brandDomain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || undefined;
  const perIntent = Math.min(25, Math.max(3, body.perIntent ?? 20));
  const panelSize = Math.min(40, Math.max(1, body.panelSize ?? 8));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));

      try {
        send({ type: "step", id: "questions", state: "running" });
        let all: string[];
        if (body.questions?.length) {
          all = body.questions.map((q) => q.trim()).filter(Boolean);
          send({ type: "questions", questions: all, generated: false });
        } else {
          const generated = await generateQuestions(getLLM({ cache: true, record: true, json: false }), topic, market, perIntent);
          all = generated.map((q) => q.text);
          send({ type: "questions", questions: all, generated: true });
        }
        send({ type: "step", id: "questions", state: "done", note: `${all.length} questions written for ${market}` });

        /**
         * Which of them get asked. Spread across the generated order rather than taking
         * the first N, because the generator emits angle by angle and the first eight
         * would all be the same buying angle.
         */
        const stride = Math.max(1, Math.floor(all.length / panelSize));
        const panel = Array.from({ length: Math.min(panelSize, all.length) }, (_, i) => all[i * stride]).filter(Boolean);

        send({
          type: "step",
          id: "engines",
          state: "running",
          note: hasApifyToken()
            ? `Asking 5 engines ${panel.length} of the ${all.length} questions`
            : "No APIFY_TOKEN, replaying the recorded panel",
        });
        send({ type: "panelQuestions", questions: panel });

        const run = await runPanel({ topic, market, questions: panel, brandDomain }, (e) => send({ type: "engineProgress", ...e }));

        send({
          type: "step",
          id: "engines",
          state: "done",
          note:
            run.source === "live"
              ? `${run.questions.length} questions answered live${run.costUsd !== null ? `, $${run.costUsd.toFixed(4)}` : ""}`
              : `recorded panel replayed, ${run.questions.length} questions`,
        });

        send({ type: "step", id: "board", state: "running" });
        const board = buildBoard(run.questions, brandDomain);
        const target = primaryTarget(board);
        send({
          type: "step",
          id: "board",
          state: "done",
          note: `${board.totalCitations} citations across ${board.rows.length} domains`,
        });

        // the teardown of the widest-reaching rival, computed from the same citations
        const teardown = target ? teardownFromCitations(board, run.questions, target.domain) : null;
        send({ type: "done", run, board, target: target?.domain ?? null, teardown, allQuestions: all });
      } catch (e) {
        send({ type: "error", error: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
