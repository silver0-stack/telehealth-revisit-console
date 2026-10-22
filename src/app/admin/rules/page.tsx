import { CATEGORY_LABEL, periodLabel } from "@/components/labels";
import { formatSeoul } from "@/components/format";
import { StatusLine } from "@/components/StatusLine";
import { DRUGS, findDrug } from "@/data/drugs";
import { getRules, listRuleVersions } from "@/data/rules";
import type { Rules } from "@/domain/rules";
import { DrugCategorySchema } from "@/domain/types";
import { saveRulesAction } from "./actions";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const ERROR_TEXT: Record<string, string> = {
  blockedCategories: "차단 분류 값이 올바르지 않아요.",
  blockedDrugCodes: "차단할 약 목록에 알 수 없는 약이 있어요.",
  maxDays: "초진 처방일수는 1~365 사이 숫자로 적어 주세요.",
  extendedMaxDays: "예외 처방일수는 1~365 사이이고, 초진 처방일수보다 작을 수 없어요.",
  extendedTimesPerPatient: "예외 사용 횟수는 0~10 사이 숫자로 적어 주세요.",
  note: "변경 이유를 5~200자로 적어 주세요. 버전 기록에 남아요.",
};

const RESTRICTED_CATEGORIES = DrugCategorySchema.options.filter((c) => c !== "general");
const inputClass = "mt-1 block w-full rounded border border-border bg-surface px-3 py-2 text-text";

function prescriptionSummary(rules: Rules): string {
  const p = rules.prescription;
  const categories = p.blockedCategories.map((c) => CATEGORY_LABEL[c]).join(", ") || "없음";
  const drugs = p.blockedDrugCodes.map((c) => findDrug(c)?.name ?? c).join(", ") || "없음";
  const limit = p.firstVisitLimit
    ? `초진 ${p.firstVisitLimit.maxDays}일, 예외 ${p.firstVisitLimit.extendedMaxDays}일 ${p.firstVisitLimit.extendedTimesPerPatient}회`
    : "초진 처방일수 제한 없음";
  return `차단 분류: ${categories} · 개별 차단 약: ${drugs} · ${limit}`;
}

export default async function RulesAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const { saved, error } = await searchParams;
  const rules = getRules();
  const versions = listRuleVersions();
  const limit = rules.prescription.firstVisitLimit;
  const errorFields = typeof error === "string" ? error.split(",") : [];

  return (
    <>
      <h1 className="text-2xl font-bold">규칙 관리</h1>
      <p className="mt-1 text-text-muted">
        비대면 처방 차단 목록을 고치면 기존 버전은 그대로 두고 새 버전으로 저장해요. 저장한 버전은 바로 적용돼요.
      </p>

      <div className="mt-4 space-y-3" aria-live="polite">
        {typeof saved === "string" ? (
          <StatusLine tone="ok" title={`${saved} 버전으로 저장했어요`}>
            처방 확인 화면이 이제 {saved} 규칙을 써요.
          </StatusLine>
        ) : null}
        {errorFields.length > 0 ? (
          <StatusLine tone="danger" title="저장하지 않았어요">
            <ul className="list-disc pl-5">
              {errorFields.map((f) => (
                <li key={f}>{ERROR_TEXT[f] ?? `${f} 값을 확인해 주세요.`}</li>
              ))}
            </ul>
          </StatusLine>
        ) : null}
      </div>

      <section className="mt-6" aria-labelledby="current-heading">
        <h2 id="current-heading" className="text-xl font-bold">
          지금 적용 중: {rules.version}
        </h2>
        <dl className="mt-2 grid gap-x-4 gap-y-1 rounded border border-border bg-surface p-4 sm:grid-cols-[10rem_1fr]">
          <dt className="font-semibold">근거</dt>
          <dd>{rules.source}</dd>
          <dt className="font-semibold">재진 기간</dt>
          <dd>같은 증상 대면 진료 후 {periodLabel(rules.followUp.window)}</dd>
          <dt className="font-semibold">초진 지역</dt>
          <dd>
            {rules.firstVisit.requireSameRegion
              ? `같은 시·도만 (예외 대상 ${rules.firstVisit.outsideRegionExceptions.length}종)`
              : "확인 안 함"}
          </dd>
          <dt className="font-semibold">처방</dt>
          <dd>{prescriptionSummary(rules)}</dd>
        </dl>
        <p className="mt-2 text-text-muted">
          재진 기간과 초진 지역은 이 화면에서 바꾸지 않아요. 바꾸려면 규칙 파일을 새로 추가하세요.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="edit-heading">
        <h2 id="edit-heading" className="text-xl font-bold">
          처방 규칙 고치기
        </h2>
        <form action={saveRulesAction} className="mt-2 space-y-6 rounded border border-border bg-surface p-4">
          <fieldset>
            <legend className="font-semibold">비대면으로 처방할 수 없는 분류</legend>
            <div className="mt-2 space-y-1">
              {RESTRICTED_CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="blockedCategories"
                    value={c}
                    defaultChecked={rules.prescription.blockedCategories.includes(c)}
                  />
                  {CATEGORY_LABEL[c]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-semibold">개별로 차단할 약</legend>
            <p className="text-text-muted">분류와 상관없이 이 의원에서 비대면 처방을 막을 약을 고르세요.</p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {DRUGS.map((d) => (
                <label key={d.code} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="blockedDrugCodes"
                    value={d.code}
                    defaultChecked={rules.prescription.blockedDrugCodes.includes(d.code)}
                  />
                  {d.name} <span className="text-text-muted">({CATEGORY_LABEL[d.category]})</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-semibold">초진 처방일수</legend>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" name="limitEnabled" defaultChecked={limit !== null} />
              초진 처방일수 제한 사용
            </label>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="maxDays">기본 최대 일수</label>
                <input
                  id="maxDays"
                  name="maxDays"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={limit?.maxDays ?? 7}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="extendedMaxDays">예외 최대 일수</label>
                <input
                  id="extendedMaxDays"
                  name="extendedMaxDays"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={limit?.extendedMaxDays ?? 30}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="extendedTimesPerPatient">환자당 예외 횟수</label>
                <input
                  id="extendedTimesPerPatient"
                  name="extendedTimesPerPatient"
                  type="number"
                  min={0}
                  max={10}
                  defaultValue={limit?.extendedTimesPerPatient ?? 1}
                  className={inputClass}
                />
              </div>
            </div>
          </fieldset>

          <div>
            <label htmlFor="note" className="font-semibold">
              변경 이유 (버전 기록에 남아요)
            </label>
            <input
              id="note"
              name="note"
              required
              minLength={5}
              maxLength={200}
              placeholder="예: 원내 정책으로 이소트레티노인 비대면 처방 중단"
              className={inputClass}
            />
          </div>

          <button type="submit" className="rounded bg-accent px-4 py-2 font-semibold text-accent-contrast">
            새 버전으로 저장
          </button>
        </form>
      </section>

      <section className="mt-8" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-xl font-bold">
          버전 기록
        </h2>
        <div className="mt-2 overflow-x-auto rounded border border-border bg-surface">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">규칙 버전 기록, 오래된 것부터</caption>
            <thead className="border-b border-border">
              <tr>
                <th scope="col" className="px-3 py-2">버전</th>
                <th scope="col" className="px-3 py-2">출처</th>
                <th scope="col" className="px-3 py-2">재진 기간</th>
                <th scope="col" className="px-3 py-2">처방 규칙</th>
                <th scope="col" className="px-3 py-2">근거 / 변경 이유</th>
              </tr>
            </thead>
            <tbody>
              {versions.map(({ rules: r, origin, savedAt, savedBy }) => (
                <tr key={r.version} className="border-b border-border align-top last:border-0">
                  <th scope="row" className="px-3 py-2 font-mono">
                    {r.version}
                    {r.version === rules.version ? (
                      <span className="block font-sans text-sm text-status-ok">✓ 적용 중</span>
                    ) : null}
                  </th>
                  <td className="px-3 py-2">
                    {origin === "file" ? "규칙 파일" : `${savedBy ?? "관리자"} · ${savedAt ? formatSeoul(savedAt) : ""}`}
                  </td>
                  <td className="px-3 py-2">{periodLabel(r.followUp.window)}</td>
                  <td className="px-3 py-2">{prescriptionSummary(r)}</td>
                  <td className="px-3 py-2">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-text-muted">관리자 화면에서 저장한 버전은 데모 서버를 다시 켜면 사라져요.</p>
      </section>
    </>
  );
}
