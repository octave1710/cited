import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface LLMClient {
  answer(system: string, user: string): Promise<string>;
  readonly label: string;
}

const RECORDINGS_PATH = process.env.FIXTURES_DIR
  ? `${process.env.FIXTURES_DIR}/llm/recordings.json`
  : "./fixtures/llm/recordings.json";

type Recordings = Record<string, { answer: string; model: string; recordedAt: string }>;

const promptKey = (system: string, user: string) => createHash("sha1").update(system + "\n---\n" + user).digest("hex");

function loadRecordings(path: string): Recordings {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

/** Replays recorded real-LLM answers. Refuses to synthesize: a missing recording is an explicit error. */
export function mockLLM(path = RECORDINGS_PATH): LLMClient {
  const recordings = loadRecordings(path);
  return {
    label: "mock (recorded answers)",
    async answer(system, user) {
      const rec = recordings[promptKey(system, user)];
      if (!rec) {
        throw new Error(
          `No recorded answer for this prompt (key ${promptKey(system, user).slice(0, 8)}...). ` +
            `Run once with LLM_MODE=real and RECORD=1 to record it. The mock never invents engine answers.`,
        );
      }
      return rec.answer;
    },
  };
}

export function openaiLLM(opts: { record?: boolean; recordingsPath?: string } = {}): LLMClient {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing from .env (required for LLM_MODE=real)");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const path = opts.recordingsPath ?? RECORDINGS_PATH;

  return {
    label: `openai:${model}${opts.record ? " (recording)" : ""}`,
    async answer(system, user) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      const answer = data.choices[0]?.message?.content ?? "";
      if (!answer) throw new Error("OpenAI returned an empty answer");

      if (opts.record) {
        const recordings = loadRecordings(path);
        recordings[promptKey(system, user)] = { answer, model, recordedAt: new Date().toISOString() };
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, JSON.stringify(recordings, null, 2));
      }
      return answer;
    },
  };
}

/** Mode switch lives in .env (LLM_MODE=mock|real). The demo runs fully offline on mock. */
export function getLLM(): LLMClient {
  const mode = process.env.LLM_MODE ?? "mock";
  if (mode === "real") return openaiLLM({ record: process.env.RECORD === "1" });
  return mockLLM();
}
