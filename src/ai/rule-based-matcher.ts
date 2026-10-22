import type { MatchLabel, SymptomMatch } from "../domain/symptom.ts";
import type { MatchInput, SymptomMatcher } from "./symptom-matcher.ts";
import { SYMPTOM_KEYWORDS, SYNONYMS_VERSION } from "./synonyms.ts";

function normalize(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

/** KCD codes whose keywords appear in the text. */
export function findCodes(text: string): Set<string> {
  const t = normalize(text);
  const codes = new Set<string>();
  for (const [code, words] of Object.entries(SYMPTOM_KEYWORDS)) {
    if (words.some((w) => t.includes(w))) codes.add(code);
  }
  return codes;
}

// The first letter of a KCD code is its chapter (J = respiratory, M = musculoskeletal, ...),
// a cheap stand-in for "related".
function chapter(code: string): string {
  return code.charAt(0);
}

// These numbers are fixed confidence levels for each rule, not learned probabilities.
// M4's calibration table shows how well they line up with reality.
const LEVELS: Record<string, { label: MatchLabel; p: [number, number, number] }> = {
  sameOnly: { label: "same", p: [0.9, 0.07, 0.03] },
  sameAmongOthers: { label: "same", p: [0.7, 0.2, 0.1] },
  related: { label: "related", p: [0.15, 0.7, 0.15] },
  different: { label: "different", p: [0.05, 0.1, 0.85] },
  unknown: { label: "related", p: [0.33, 0.34, 0.33] },
};

export class RuleBasedMatcher implements SymptomMatcher {
  async match({ todaySymptom, previousNote, previousKcdCode }: MatchInput): Promise<SymptomMatch> {
    const today = findCodes(todaySymptom);
    const previous = new Set([previousKcdCode, ...findCodes(previousNote)]);

    let level: keyof typeof LEVELS;
    let explanation: string;
    const shared = [...today].filter((c) => previous.has(c));
    if (today.size === 0) {
      level = "unknown";
      explanation = "오늘 증상에서 아는 표현을 찾지 못했어요.";
    } else if (shared.length > 0) {
      level = today.size === 1 ? "sameOnly" : "sameAmongOthers";
      explanation = `오늘 증상이 이전 진료(${shared.join(", ")})와 같은 표현을 포함해요.`;
    } else if ([...today].some((c) => [...previous].some((p) => chapter(p) === chapter(c)))) {
      level = "related";
      explanation = `오늘 증상(${[...today].join(", ")})이 이전 진료와 같은 계통이에요.`;
    } else {
      level = "different";
      explanation = `오늘 증상(${[...today].join(", ")})이 이전 진료(${previousKcdCode})와 달라요.`;
    }

    const { label, p } = LEVELS[level]!;
    return {
      label,
      probabilities: { same: p[0], related: p[1], different: p[2] },
      matcher: { kind: "rules", id: "rule-based", version: SYNONYMS_VERSION },
      explanation,
    };
  }
}
