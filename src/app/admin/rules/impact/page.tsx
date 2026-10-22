import Link from "next/link";
import { ImpactReport } from "@/components/ImpactReport";
import { StatusLine } from "@/components/StatusLine";
import { getRecordSource } from "@/data";
import { DRUGS } from "@/data/drugs";
import { computeImpact } from "@/data/impact";
import { KCD_NAMES } from "@/data/kcd";
import { listRuleVersions } from "@/data/rules";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const selectClass = "mt-1 block rounded border border-border bg-surface px-3 py-2 text-text";

export default async function RuleImpactPage({ searchParams }: { searchParams: SearchParams }) {
  const { from, to } = await searchParams;
  const versions = listRuleVersions().map((e) => e.rules);
  const fromRules = versions.find((r) => r.version === from);
  const toRules = versions.find((r) => r.version === to);
  // Default to the most recent change, which is the question people usually have.
  const defaultFrom = versions.at(-2)?.version ?? versions[0]?.version;
  const defaultTo = versions.at(-1)?.version;

  const diff = fromRules && toRules ? await computeImpact(fromRules, toRules) : null;
  const [patients, today] = await Promise.all([getRecordSource().listPatients(), getRecordSource().getToday()]);

  return (
    <>
      <p>
        <Link href="/admin/rules" className="text-accent underline">
          ← 규칙 관리
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold">규칙 버전 비교</h1>
      <p className="mt-1 text-text-muted">
        두 규칙 버전 사이에 진료 구분과 처방 결과가 바뀌는 환자를 보여 줘요. 기준일 {today}.
      </p>

      <form action="/admin/rules/impact" method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="from" className="font-semibold">
            이전 버전
          </label>
          <select id="from" name="from" defaultValue={typeof from === "string" ? from : defaultFrom} className={selectClass}>
            {versions.map((r) => (
              <option key={r.version} value={r.version}>
                {r.version}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="to" className="font-semibold">
            새 버전
          </label>
          <select id="to" name="to" defaultValue={typeof to === "string" ? to : defaultTo} className={selectClass}>
            {versions.map((r) => (
              <option key={r.version} value={r.version}>
                {r.version}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded bg-accent px-4 py-2 font-semibold text-accent-contrast">
          비교
        </button>
      </form>

      <div className="mt-6" aria-live="polite">
        {from === undefined && to === undefined ? (
          <p className="rounded border border-dashed border-border p-4">
            비교할 두 버전을 고르고 &ldquo;비교&rdquo;를 누르세요.
          </p>
        ) : !diff ? (
          <StatusLine tone="danger" title="버전을 찾을 수 없어요">
            목록에 있는 버전을 다시 고르세요. 관리자 화면에서 저장한 버전은 서버를 다시 켜면 사라져요.
          </StatusLine>
        ) : (
          <>
            <h2 className="mb-4 text-xl font-bold">
              {diff.from} → {diff.to}
            </h2>
            <ImpactReport
              diff={diff}
              toLabel={diff.to}
              patientNames={new Map(patients.map((p) => [p.id, p.displayName]))}
              drugNames={new Map(DRUGS.map((d) => [d.code, d.name]))}
              kcdNames={KCD_NAMES}
            />
          </>
        )}
      </div>
    </>
  );
}
