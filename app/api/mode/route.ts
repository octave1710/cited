import { llmMode } from "../../../adapters/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What the status bar reports.
 *
 * The bar used to read ENGINE MOCK on every page because all four passed the string
 * "mock" as a literal prop, while the engine was answering live against OpenAI. A
 * label anyone in the room can check and find false costs more than it saves, and
 * this tool's whole claim is that nothing on screen is invented.
 */
export function GET() {
  const llm = llmMode();
  const profound = (process.env.PROFOUND_MODE ?? "mock") === "real" ? "live" : "mock";
  return Response.json({ engine: llm.mode, engineWhy: llm.why, profound });
}
