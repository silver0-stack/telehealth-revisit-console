import { z } from "zod";
import raw from "../../config/ai.json" with { type: "json" };

const AiConfigSchema = z.object({
  // Below this top probability the UI shows "의사 확인 필요" and pre-selects nothing.
  // Start at 0.8 and tune it from the M4 evaluation results.
  minConfidence: z.number().min(0).max(1),
});
export type AiConfig = z.infer<typeof AiConfigSchema>;

const config = AiConfigSchema.parse(raw);

export function getAiConfig(): AiConfig {
  return config;
}
