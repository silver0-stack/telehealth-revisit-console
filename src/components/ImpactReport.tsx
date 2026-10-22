import type { RuleDiff } from "@/domain/rule-diff";
import { ELIGIBILITY_SHORT, PRESCRIPTION_REASON_SHORT } from "./labels";

type Props = {
  diff: RuleDiff;
  /** Label for the "to" side, e.g. "v2" or "저장 전 새 버전". */
  toLabel: string;
  patientNames: ReadonlyMap<string, string>;
  drugNames: ReadonlyMap<string, string>;
  kcdNames: Readonly<Record<string, string>>;
};

// Arrow + word, so the direction never depends on color alone.
function Direction({ worse }: { worse: boolean }) {
  return worse ? (
    <span className="whitespace-nowrap text-status-danger">
      <span aria-hidden="true">▼ </span>나빠짐
    </span>
  ) : (
    <span className="whitespace-nowrap text-status-ok">
      <span aria-hidden="true">▲ </span>좋아짐
    </span>
  );
}

export function ImpactReport({ diff, toLabel, patientNames, drugNames, kcdNames }: Props) {
  const c = diff.counts;
  const tiles = [
    { label: "재진에서 초진·불가로", value: c.lostFollowUp, worse: true },
    { label: "새로 재진이 됨", value: c.gainedFollowUp, worse: false },
    { label: "비대면진료 불가로", value: c.lostTelehealth, worse: true },
    { label: "비대면진료 가능으로", value: c.gainedTelehealth, worse: false },
    { label: "새로 막히는 처방", value: c.newlyBlocked, worse: true },
    { label: "새로 풀리는 처방", value: c.newlyAllowed, worse: false },
  ];
  const patientLabel = (id: string) => `${patientNames.get(id) ?? ""} (${id})`;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-surface p-3">
            <dt className="text-sm text-text-muted">
              <span aria-hidden="true">{t.worse ? "▼ " : "▲ "}</span>
              {t.label}
            </dt>
            <dd className="text-2xl font-bold">{t.value}건</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="eligibility-changes">
        <h3 id="eligibility-changes" className="text-lg font-bold">
          진료 구분이 바뀌는 경우 ({diff.eligibilityChanges.length}건 / 전체 {diff.scenarios}건)
        </h3>
        {diff.eligibilityChanges.length === 0 ? (
          <p className="mt-2 rounded border border-dashed border-border p-3">바뀌는 경우가 없어요.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded border border-border bg-surface">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                {diff.from}에서 {toLabel}로 바꿀 때 진료 구분이 바뀌는 환자
              </caption>
              <thead className="border-b border-border">
                <tr>
                  <th scope="col" className="px-3 py-2">환자</th>
                  <th scope="col" className="px-3 py-2">오늘 신청한다면 (증상)</th>
                  <th scope="col" className="px-3 py-2">{diff.from}</th>
                  <th scope="col" className="px-3 py-2">{toLabel}</th>
                  <th scope="col" className="px-3 py-2">변화</th>
                </tr>
              </thead>
              <tbody>
                {diff.eligibilityChanges.map((ch) => (
                  <tr key={`${ch.patientId}-${ch.kcdCode ?? "new"}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">{patientLabel(ch.patientId)}</td>
                    <td className="px-3 py-2">
                      {ch.kcdCode ? `${ch.kcdCode} ${kcdNames[ch.kcdCode] ?? ""}` : "처음 보는 증상"}
                    </td>
                    <td className="px-3 py-2">{ELIGIBILITY_SHORT[ch.before]}</td>
                    <td className="px-3 py-2">{ELIGIBILITY_SHORT[ch.after]}</td>
                    <td className="px-3 py-2">
                      <Direction worse={ch.direction === "worse"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="order-changes">
        <h3 id="order-changes" className="text-lg font-bold">
          처방 결과가 바뀌는 경우 ({diff.orderChanges.length}건 / 전체 {diff.orders}건)
        </h3>
        {diff.orderChanges.length === 0 ? (
          <p className="mt-2 rounded border border-dashed border-border p-3">바뀌는 처방이 없어요.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded border border-border bg-surface">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                {diff.from}에서 {toLabel}로 바꿀 때 결과가 바뀌는 재처방
              </caption>
              <thead className="border-b border-border">
                <tr>
                  <th scope="col" className="px-3 py-2">환자</th>
                  <th scope="col" className="px-3 py-2">약 · 일수</th>
                  <th scope="col" className="px-3 py-2">{diff.from}</th>
                  <th scope="col" className="px-3 py-2">{toLabel}</th>
                  <th scope="col" className="px-3 py-2">변화</th>
                </tr>
              </thead>
              <tbody>
                {diff.orderChanges.map((ch) => (
                  <tr key={`${ch.patientId}-${ch.drugCode}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">{patientLabel(ch.patientId)}</td>
                    <td className="px-3 py-2">
                      {drugNames.get(ch.drugCode) ?? ch.drugCode} {ch.days}일
                    </td>
                    <td className="px-3 py-2">{PRESCRIPTION_REASON_SHORT[ch.before]}</td>
                    <td className="px-3 py-2">{PRESCRIPTION_REASON_SHORT[ch.after]}</td>
                    <td className="px-3 py-2">
                      <Direction worse={ch.direction === "newly_blocked"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <details className="rounded border border-border bg-surface p-3">
        <summary className="cursor-pointer font-semibold">이 숫자는 어떻게 계산했나요?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>환자마다 &ldquo;예전에 대면 진료받은 증상으로 오늘 비대면 신청을 하면?&rdquo;과 &ldquo;처음 보는 증상으로 신청하면?&rdquo;을 두 규칙으로 각각 판단해 비교했어요.</li>
          <li>처방은 약마다 가장 최근 처방을 같은 일수로 비대면 재처방한다고 보고, 의사가 이력 확인과 치료 지속 판단을 했다고 가정했어요.</li>
          <li>기준일은 데모 기준일이에요. 실제 영향은 실제 요청과 처방에 따라 달라져요.</li>
        </ul>
      </details>
    </div>
  );
}
