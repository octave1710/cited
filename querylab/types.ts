export interface LabQuery {
  id: string;
  text: string;
  source: "user" | "fanout";
}

export type CitationStatus = "cited" | "paraphrased" | "absent";

export interface LabDoc {
  /** Stable identifier, e.g. file name or URL. */
  id: string;
  title: string;
  /** Plain-text excerpt handed to the engine as a source. */
  excerpt: string;
  /** Distinctive markers (figures, named experts) used for paraphrase detection. */
  markers: string[];
}

export interface QueryVerdict {
  query: LabQuery;
  status: CitationStatus;
  /** Doc ids the engine cited, in citation order. */
  citedDocs: string[];
  /** Markers of the target found in the answer (paraphrase evidence). */
  matchedMarkers: string[];
  answer: string;
}

export interface LabRun {
  targetId: string;
  competitors: string[];
  llm: string;
  /**
   * How many of the answers came off the network and how many off the recording.
   *
   * `getLLM` caches by default, so a question asked before comes back in milliseconds.
   * The screen said "test citations on a live engine" either way, and a re-test that
   * finished in half a second while claiming a live engine is a claim anyone in the room
   * can doubt and nobody can check. Both counts are now reported.
   */
  live: number;
  replayed: number;
  verdicts: QueryVerdict[];
  citedCount: number;
  total: number;
}
