// Inloggningskonton: e-post → konsult-id. Finns bara på servern.
// Källa: konsultdokumentet + variant.se/se/varianter (kontor: Stockholm).
export const ACCOUNTS: Record<string, string> = {
  "alexander.klimberg@variant.se": "alexander",
  "david.dinka@variant.se": "david",
  "ellen.cardenas@variant.se": "ellen",
  "emil.scott@variant.se": "emil",
  "jacqline.runsten@variant.se": "jacqline",
  "jessica.wiklund@variant.se": "jessica",
  "johanna.granstrom@variant.se": "johanna",
  "karolina.pamp@variant.se": "karolina",
  "linn.norberg@variant.se": "linn",
  "liza.hansson@variant.se": "liza",
  "lotta.gerdt@variant.se": "lotta",
  "mathias.jarboh@variant.se": "mathias",
  "mattias.hallberg@variant.se": "mattias",
  "pedram.nayeri@variant.se": "pedram",
  "rhoda.carlsson@variant.se": "rhoda",
  "sara.doltz@variant.se": "sara_d",
  "sara.hernandez@variant.se": "sara_h",
  "sofia.frojdman@variant.se": "sofia",
  "staffan.hesselbom@variant.se": "staffan",
};

export const DEFAULT_PASSWORD = "BANAN";

/** Normaliserar e-post: skiftlägesokänslig, trimmad, tål å/ä/ö och accenter i lokaldelen. */
export function normalizeEmail(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
