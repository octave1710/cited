import type { FactorResult, ParsedPage } from "../types";

export const QUESTION_RE = /^(what|how|why|when|where|which|who|can|does|do|is|are|should)\b|[?]\s*$/i;
const FILLER_RE = /^(in this (article|guide|post)|welcome|when it comes to|there are many|nowadays|it('|’)s no secret)/i;

/** H2/H3 phrased as questions, first sentence = the answer, passages that stand alone. */
export function answerStructure(page: ParsedPage): FactorResult {
  const subHeads = page.headings.filter((h) => h.level === 2 || h.level === 3);
  const questionHeads = subHeads.filter((h) => QUESTION_RE.test(h.text));
  const qRatio = subHeads.length ? questionHeads.length / subHeads.length : 0;

  const questionSections = page.sections.filter(
    (s) => s.heading && QUESTION_RE.test(s.heading.text) && s.paragraphs.length > 0,
  );
  let answerFirst = 0;
  const evidence: string[] = [];
  for (const s of questionSections) {
    const firstSentence = s.paragraphs[0].split(/(?<=[.!?])\s/)[0];
    const ok = firstSentence.split(" ").length <= 40 && !FILLER_RE.test(firstSentence);
    if (ok) {
      answerFirst++;
      if (evidence.length < 2) evidence.push(`"${s.heading!.text}" → answered in sentence one: "${firstSentence}"`);
    } else if (evidence.length < 3) {
      evidence.push(`"${s.heading!.text}" → first sentence does NOT answer it: "${firstSentence.slice(0, 90)}..."`);
    }
  }
  const afRatio = questionSections.length ? answerFirst / questionSections.length : 0;

  const allParas = page.sections.flatMap((s) => s.paragraphs);
  const standalone = allParas.filter((p) => {
    const w = p.split(" ").length;
    return w >= 25 && w <= 120;
  });
  const standaloneRatio = allParas.length ? standalone.length / allParas.length : 0;

  evidence.unshift(`${questionHeads.length}/${subHeads.length} subheadings are question-phrased`);
  evidence.push(`${standalone.length}/${allParas.length} passages are self-contained (25-120 words, liftable as a standalone answer)`);

  return {
    key: "answerStructure",
    name: "Answer-first structure & self-contained passages",
    score: Math.round(40 * qRatio + 35 * afRatio + 25 * standaloneRatio),
    evidence,
    reasoning: "Answer engines lift passages, not pages. A question heading whose first sentence is the answer is the most extractable unit of content.",
  };
}
