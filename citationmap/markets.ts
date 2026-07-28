/**
 * A market is a language, not a flag.
 *
 * The map was generating questions in whatever language the topic happened to be typed
 * in, so "matelas" on the Swedish market produced English questions containing a French
 * word. That measures nothing: a Swedish buyer types Swedish, the engine answers in
 * Swedish, and it cites Swedish sources. Getting the language wrong makes every domain
 * in the result the wrong set.
 */

export interface Market {
  code: string;
  label: string;
  /** The language buyers actually type in, named in English for the prompt. */
  language: string;
  /** BCP-47, for lang attributes and any future locale formatting. */
  locale: string;
}

export const MARKETS: Market[] = [
  { code: "UK", label: "United Kingdom", language: "British English", locale: "en-GB" },
  { code: "US", label: "United States", language: "American English", locale: "en-US" },
  { code: "FR", label: "France", language: "French", locale: "fr-FR" },
  { code: "SE", label: "Sweden", language: "Swedish", locale: "sv-SE" },
  { code: "DK", label: "Denmark", language: "Danish", locale: "da-DK" },
  { code: "DE", label: "Germany", language: "German", locale: "de-DE" },
  { code: "ES", label: "Spain", language: "Spanish", locale: "es-ES" },
  { code: "IT", label: "Italy", language: "Italian", locale: "it-IT" },
  { code: "NL", label: "Netherlands", language: "Dutch", locale: "nl-NL" },
];

const BY_CODE = new Map(MARKETS.map((m) => [m.code.toUpperCase(), m]));

/** Unknown codes fall back to the UK rather than throwing, and say so to the caller. */
export function marketOf(code: string): Market {
  return BY_CODE.get((code ?? "").trim().toUpperCase()) ?? MARKETS[0];
}

export const isKnownMarket = (code: string): boolean => BY_CODE.has((code ?? "").trim().toUpperCase());
