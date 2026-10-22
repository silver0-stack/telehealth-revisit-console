import { experimental_decide } from "ai";
import { z } from "zod";
import { KCD_NAMES } from "../data/kcd.ts";
import type { SymptomMatch } from "../domain/symptom.ts";
import type { MatchInput, SymptomMatcher } from "./symptom-matcher.ts";

// Checked against https://vercel.com/docs/ai-gateway/modalities/decision (2026-10-22):
// `experimental_decide` (ai >= 7.0.128) takes { model, state, questions } and a "choice" question
// returns { choice, probabilities }. The AI SDK types mark `probabilities` as optional, so we
// validate the answer and fail loudly instead of inventing numbers.
const AnswerSchema = z.object({
  choice: z.enum(["same", "related", "different"]),
  probabilities: z.object({
    same: z.number().min(0).max(1),
    related: z.number().min(0).max(1),
    different: z.number().min(0).max(1),
  }),
});

// The one question Jev is allowed to answer (see CLAUDE.md "AI: Jev").
const QUESTION = {
  type: "choice",
  instructions:
    "Compare the patient's complaint today with the note from their earlier in-person visit. " +
    "Both are in Korean. Patients use everyday words; the note uses clinical words.",
  criteria: {
    same: "the same condition as the earlier visit, even if worded differently or with typos",
    related: "a different condition in the same body system, or a likely complication of the earlier condition",
    different: "an unrelated condition, or too vague to tell",
  },
} as const;

type DecideFn = typeof experimental_decide;

export class JevMatcher implements SymptomMatcher {
  private readonly modelId: string;
  private readonly decide: DecideFn;

  // `decide` is injected so tests can check the mapping without a network call or an API key.
  constructor(modelId: string, decide: DecideFn = experimental_decide) {
    this.modelId = modelId;
    this.decide = decide;
  }

  async match({ todaySymptom, previousNote, previousKcdCode }: MatchInput): Promise<SymptomMatch> {
    // Only synthetic text and a public classification code are sent. No ids, names or dates.
    const result = await this.decide({
      model: this.modelId,
      state: {
        today_complaint: todaySymptom,
        earlier_visit: {
          diagnosis: `${previousKcdCode} ${KCD_NAMES[previousKcdCode] ?? ""}`.trim(),
          note: previousNote,
        },
      },
      questions: { match: QUESTION },
    });

    const parsed = AnswerSchema.safeParse(result.answers.match);
    if (!parsed.success) {
      throw new Error(`Jev returned an answer without usable probabilities: ${parsed.error.message}`);
    }
    const p = parsed.data.probabilities;
    const sum = p.same + p.related + p.different;
    if (Math.abs(sum - 1) > 0.02) throw new Error(`Jev probabilities do not sum to 1 (sum=${sum})`);

    return {
      label: parsed.data.choice,
      probabilities: { same: p.same / sum, related: p.related / sum, different: p.different / sum },
      // The model that actually answered, which can differ from the requested alias.
      matcher: { kind: "ai", id: "typesafe-ai/jev", version: result.response.modelId || this.modelId },
      explanation: null,
    };
  }
}
