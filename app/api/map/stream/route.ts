import { getLLM } from "../../../../adapters/llm";
import { runCitationMap } from "../../../../citationmap/run";
import { saveMap } from "../../../../lib/mapdb";

export const runtime = "nodejs";

/**
 * The citation map as a stream. Every question is answered by the same engine the
 * client's buyers use, and each result lands on the wire the moment it comes back,
 * so the grid fills with measured work instead of appearing finished.
 */
export async function POST(req: Request) {
  let body: { topic?: string; brand?: string; brandDomain?: string; market?: string; perIntent?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Malformed request body." }), { status: 400 });
  }

  const topic = (body.topic ?? "").trim();
  const brandDomain = (body.brandDomain ?? "").trim();
  if (!topic) return new Response(JSON.stringify({ error: "A topic is required to map a category." }), { status: 400 });
  if (!brandDomain)
    return new Response(JSON.stringify({ error: "Your own domain is required, otherwise nothing can be scored as yours." }), {
      status: 400,
    });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        // cache on: a re-run of the same category costs nothing and the demo replays offline
        const llm = getLLM({ cache: true, record: true, json: true });
        send({ type: "engine", label: llm.label, mode: process.env.LLM_MODE ?? "mock" });

        const map = await runCitationMap(
          llm,
          {
            topic,
            brand: (body.brand ?? "").trim() || "Unnamed brand",
            brandDomain,
            market: (body.market ?? "").trim() || "UK",
            perIntent: Math.min(Math.max(body.perIntent ?? 20, 5), 25),
          },
          {
            onQuestions: (questions) => send({ type: "questions", questions }),
            onResult: (result, cost) => send({ type: "result", result, cost }),
          },
        );

        try {
          saveMap(map);
        } catch (e) {
          console.error("saveMap failed:", (e as Error).message);
        }
        send({ type: "done", map });
      } catch (e) {
        send({ type: "error", error: (e as Error).message });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
