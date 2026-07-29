import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Token counts as reported by the provider. Absent on a replayed answer, which costs nothing. */
export interface LLMUsage {
  in: number;
  out: number;
}

export interface LLMResponse {
  text: string;
  usage?: LLMUsage;
  /** True when the text came from a recording rather than the network. */
  replayed: boolean;
}

export interface LLMClient {
  answer(system: string, user: string): Promise<string>;
  /** Same call, with the provider's own token counts, so cost is measured rather than estimated. */
  call(system: string, user: string): Promise<LLMResponse>;
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
  const client: LLMClient = {
    label: "mock (recorded answers)",
    async answer(system, user) {
      return (await client.call(system, user)).text;
    },
    async call(system, user) {
      const rec = recordings[promptKey(system, user)];
      if (!rec) {
        throw new Error(
          `No recorded answer for this prompt (key ${promptKey(system, user).slice(0, 8)}...). ` +
            `Run once with LLM_MODE=real and RECORD=1 to record it. The mock never invents engine answers.`,
        );
      }
      return { text: rec.answer, replayed: true };
    },
  };
  return client;
}

export interface OpenAIOpts {
  /** Persist every fresh answer to the recordings file. */
  record?: boolean;
  /** Serve from the recordings file before hitting the network. Makes a re-run free. */
  cache?: boolean;
  /** Force `response_format: json_object` for callers that parse the answer. */
  json?: boolean;
  recordingsPath?: string;
}

export function openaiLLM(opts: OpenAIOpts = {}): LLMClient {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing from .env (required for LLM_MODE=real)");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const path = opts.recordingsPath ?? RECORDINGS_PATH;

  const client: LLMClient = {
    label: `openai:${model}${opts.record ? " (recording)" : ""}`,
    async answer(system, user) {
      return (await client.call(system, user)).text;
    },
    async call(system, user) {
      const key = promptKey(system, user);
      if (opts.cache) {
        const hit = loadRecordings(path)[key];
        if (hit) return { text: hit.answer, replayed: true };
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as {
        choices: { message: { content: string } }[];
        usage?: { prompt_tokens: number; completion_tokens: number };
      };
      const answer = data.choices[0]?.message?.content ?? "";
      if (!answer) throw new Error("OpenAI returned an empty answer");

      if (opts.record) {
        // read-modify-write per call: the map runs concurrently, so a stale in-memory
        // copy would drop siblings recorded while this request was in flight
        const recordings = loadRecordings(path);
        recordings[key] = { answer, model, recordedAt: new Date().toISOString() };
        /**
         * A hosted build has a read-only filesystem, so this threw ENOENT on mkdir and
         * killed the whole run two seconds in. Recording is a convenience for local work,
         * never a reason to fail a request: if the disk refuses, the answer still stands.
         */
        try {
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, JSON.stringify(recordings, null, 2));
        } catch {
          // read-only or full disk; the live answer is already in hand
        }
      }
      return {
        text: answer,
        replayed: false,
        usage: data.usage ? { in: data.usage.prompt_tokens, out: data.usage.completion_tokens } : undefined,
      };
    },
  };
  return client;
}

/**
 * Mode switch lives in .env.
 *
 *   auto (default)  a key is present, so call the API and record every answer. Without a
 *                   key, replay. This is the only setting under which the app works on a
 *                   topic nobody has run before.
 *   real            always call.
 *   mock            never call, replay only. Offline demo.
 *
 * The default used to be `mock`, which meant the tool answered exactly one topic: the one
 * whose answers were on disk. Any other query failed with a message about recordings.
 * A tool that only runs its own fixtures is a slideshow.
 */
export function getLLM(opts: OpenAIOpts = {}): LLMClient {
  const mode = process.env.LLM_MODE ?? "auto";
  const hasKey = Boolean(process.env.OPENAI_API_KEY);

  if (mode === "mock") return mockLLM(opts.recordingsPath);
  if (mode === "real" || (mode === "auto" && hasKey)) {
    // cache and record are on by default in auto: a re-run of the same question is free,
    // and every live answer lands on disk so the demo replays offline afterwards
    return openaiLLM({ cache: true, record: true, ...opts, ...(process.env.RECORD === "0" ? { record: false } : {}) });
  }
  return mockLLM(opts.recordingsPath);
}

/** What the UI shows in the status bar, without needing a client instance. */
export function llmMode(): { mode: string; live: boolean; why: string } {
  const mode = process.env.LLM_MODE ?? "auto";
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  if (mode === "mock") return { mode: "replay", live: false, why: "LLM_MODE=mock, answers replay from the recording" };
  if (mode === "real") return { mode: "live", live: true, why: "LLM_MODE=real" };
  return hasKey
    ? { mode: "live", live: true, why: "a key is present, so any topic runs live and is recorded" }
    : { mode: "replay", live: false, why: "no OPENAI_API_KEY, so only recorded topics can run" };
}
