import { getLLM } from "../../../adapters/llm";
import { runAutopsy } from "../../../autopsy/run";
import { IngestError } from "../../../engine/ingest";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { domain?: string; question?: string; ourUrl?: string; theirUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }

  const ourUrl = (body.ourUrl ?? "").trim();
  const domain = (body.domain ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (!ourUrl) return Response.json({ error: "Paste your own page URL. There is nothing to compare against otherwise." }, { status: 400 });
  if (!domain && !body.theirUrl) return Response.json({ error: "Name the competitor domain, or paste their page URL." }, { status: 400 });

  try {
    const autopsy = await runAutopsy(getLLM({ cache: true, record: true, json: true }), {
      domain,
      question: (body.question ?? "").trim() || undefined,
      ourUrl,
      theirUrl: (body.theirUrl ?? "").trim() || undefined,
    });
    return Response.json({ autopsy });
  } catch (e) {
    const msg = e instanceof IngestError ? e.message : (e as Error).message;
    return Response.json({ error: msg }, { status: 422 });
  }
}
