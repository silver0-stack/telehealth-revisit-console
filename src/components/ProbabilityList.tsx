import { MATCH_LABELS, type MatchLabel } from "@/domain/symptom";
import { MATCH_LABEL_TEXT } from "./labels";

// Numbers are always written out; the bar is decoration for sighted users only.
export function ProbabilityList({ probabilities, top }: { probabilities: Record<MatchLabel, number>; top: MatchLabel }) {
  return (
    <dl className="grid grid-cols-[6rem_3.5rem_1fr] items-center gap-x-2 gap-y-1">
      {MATCH_LABELS.map((label) => {
        const pct = Math.round(probabilities[label] * 100);
        return (
          <div key={label} className="contents">
            <dt className={label === top ? "font-bold" : undefined}>{MATCH_LABEL_TEXT[label]}</dt>
            <dd className="text-right font-mono">{pct}%</dd>
            <dd aria-hidden="true" className="h-2 rounded bg-bg">
              <div className="h-2 rounded bg-accent" style={{ width: `${pct}%` }} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
