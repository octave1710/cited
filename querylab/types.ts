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
  verdicts: QueryVerdict[];
  citedCount: number;
  total: number;
}
