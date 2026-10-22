import Link from "next/link";
import { formatSeoul } from "@/components/format";
import { Icon } from "@/components/Icon";
import { ImpactReport } from "@/components/ImpactReport";
import { getRole } from "@/app/role";
import { CATEGORY_LABEL, periodLabel, ROLE_LABEL } from "@/components/labels";
import { StatusLine } from "@/components/StatusLine";
import { getRecordSource } from "@/data";
import { DRUGS, findDrug } from "@/data/drugs";
import { computeImpact } from "@/data/impact";
import { KCD_NAMES } from "@/data/kcd";
import { getRules, listRuleVersions } from "@/data/rules";
import { can } from "@/domain/roles";
import type { Rules } from "@/domain/rules";
import { DrugCategorySchema } from "@/domain/types";
import { resetDemoAction, saveRulesAction } from "./actions";
import { draftFromForm, parseRuleForm, readerFromSearchParams, type RuleForm } from "./form";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const ERROR_TEXT: Record<string, string> = {
  baseVersion: "어느 버전을 고치는지 알 수 없어요. 페이지를 새로 고친 뒤 다시 미리보기 하세요.",
  blockedCategories: "차단 분류 값이 올바르지 않아요.",
  blockedDrugCodes: "차단할 약 목록에 알 수 없는 약이 있어요.",
  maxDays: "초진 처방일수는 1~365 사이 숫자로 적어 주세요.",
  extendedMaxDays: "예외 처방일수는 1~365 사이이고, 초진 처방일수보다 작을 수 없어요.",
  extendedTimesPerPatient: "예외 사용 횟수는 0~10 사이 숫자로 적어 주세요.",
  note: "변경 이유를 5~200자로 적어 주세요. 버전 기록에 남아요.",
  STALE_PREVIEW: "미리보기 뒤에 다른 버전이 저장됐어요. 지금 규칙 기준으로 다시 미리보기 하세요.",
  FORBIDDEN_ROLE: "규칙 저장과 데모 초기화는 관리자만 할 수 있어요. 화면 위에서 역할을 \"관리자\"로 바꾸세요.",
  RESET_CONFIRM: "초기화하려면 지워지는 내용을 확인했다는 칸에 체크하세요.",
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

/** Form values to show: the previewed draft if there is one, else the current rules. */
function formDefaults(rules: Rules, draft: RuleForm | null): Omit<RuleForm, "baseVersion"> {
  if (draft) return draft;
  const limit = rules.prescription.firstVisitLimit;
  return {
    blockedCategories: rules.prescription.blockedCategories,
    blockedDrugCodes: rules.prescription.blockedDrugCodes,
    limitEnabled: limit !== null,
    maxDays: limit?.maxDays ?? 7,
    extendedMaxDays: limit?.extendedMaxDays ?? 30,
    extendedTimesPerPatient: limit?.extendedTimesPerPatient ?? 1,
    note: "",
  };
}

export default async function RulesAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { saved, error, preview, reset } = params;
  const [rules, versions, role] = await Promise.all([getRules(), listRuleVersions(), getRole()]);
  const isAdmin = can(role, "rules.save");
  const errorFields = typeof error === "string" ? error.split(",") : [];

  // Step 1 of saving: the form is sent with GET and shown here as a preview. Saving is a separate
  // button on the preview, so a new version can never be applied without seeing its impact first.
  const parsed = preview === "1" ? parseRuleForm(readerFromSearchParams(params)) : null;
  const previewErrors = parsed && !parsed.success ? [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] : [];
  const draft = parsed?.success ? parsed.data : null;
  const impact = draft ? await computeImpact(rules, { ...draftFromForm(rules, draft), version: "새 버전" }) : null;
  const defaults = formDefaults(rules, draft);

  const patients = await getRecordSource().listPatients();
  const patientNames = new Map(patients.map((p) => [p.id, p.displayName]));
  const drugNames = new Map(DRUGS.map((d) => [d.code, d.name]));

  return (
    <>
      <h1 className="text-2xl font-bold">규칙 관리</h1>
      <p className="mt-1 text-text-muted">
        저장 전 영향 미리보기 · 저장하면 새 버전 · 이전 버전 보존
      </p>

      <div className="mt-4 space-y-3" aria-live="polite">
        {reset === "1" ? (
          <StatusLine tone="ok" title="데모를 처음 상태로 되돌렸어요">
            모든 요청이 다시 검토 대기예요. 초기화 기록은 감사 로그의 첫 줄에 남았어요.
          </StatusLine>
        ) : null}
        {typeof saved === "string" ? (
          <StatusLine tone="ok" title={`${saved} 버전으로 저장했어요`}>
            처방 확인과 검토 화면이 이제 {saved} 규칙을 써요. 저장 기록은 감사 로그에 남았어요.
          </StatusLine>
        ) : null}
        {[...errorFields, ...previewErrors].length > 0 ? (
          <StatusLine tone="danger" title="저장하지 않았어요">
            <ul className="list-disc pl-5">
              {[...errorFields, ...previewErrors].map((f) => (
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
          재진 기간과 초진 지역은 규칙 파일(config/rules)에서만 바꿀 수 있어요.
        </p>
      </section>

      {draft && impact ? (
        <section className="mt-8 rounded border-2 border-accent bg-surface p-4" aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="text-xl font-bold">
            저장 전 영향 미리보기: {rules.version} → 새 버전
          </h2>
          <p className="mt-1 text-text-muted">변경 이유: {draft.note}</p>
          <div className="mt-4">
            <ImpactReport
              diff={impact}
              toLabel="새 버전"
              patientNames={patientNames}
              drugNames={drugNames}
              kcdNames={KCD_NAMES}
            />
          </div>
          {isAdmin ? null : (
            <div className="mt-6">
              <StatusLine tone="warn" title={`${ROLE_LABEL[role]} 역할에서는 미리보기만 할 수 있어요`}>
                새 버전 저장은 관리자만 할 수 있어요. 화면 위에서 역할을 &ldquo;관리자&rdquo;로 바꾸세요.
              </StatusLine>
            </div>
          )}
          <form action={saveRulesAction} className="mt-6 flex flex-wrap items-center gap-3">
            <input type="hidden" name="baseVersion" value={draft.baseVersion} />
            {draft.blockedCategories.map((c) => (
              <input key={c} type="hidden" name="blockedCategories" value={c} />
            ))}
            {draft.blockedDrugCodes.map((c) => (
              <input key={c} type="hidden" name="blockedDrugCodes" value={c} />
            ))}
            {draft.limitEnabled ? <input type="hidden" name="limitEnabled" value="on" /> : null}
            <input type="hidden" name="maxDays" value={draft.maxDays} />
            <input type="hidden" name="extendedMaxDays" value={draft.extendedMaxDays} />
            <input type="hidden" name="extendedTimesPerPatient" value={draft.extendedTimesPerPatient} />
            <input type="hidden" name="note" value={draft.note} />
            <button
              type="submit"
              disabled={!isAdmin}
              className="rounded bg-accent px-4 py-2 font-semibold text-accent-contrast disabled:cursor-not-allowed disabled:opacity-50"
            >
              이대로 새 버전으로 저장
            </button>
            <Link href="/admin/rules" className="text-accent underline">
              취소
            </Link>
          </form>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="edit-heading">
        <h2 id="edit-heading" className="text-xl font-bold">
          처방 규칙 고치기
        </h2>
        <form action="/admin/rules" method="get" className="mt-2 space-y-6 rounded border border-border bg-surface p-4">
          <input type="hidden" name="preview" value="1" />
          <input type="hidden" name="baseVersion" value={rules.version} />
          <fieldset>
            <legend className="font-semibold">비대면으로 처방할 수 없는 분류</legend>
            <div className="mt-2 space-y-1">
              {RESTRICTED_CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="blockedCategories"
                    value={c}
                    defaultChecked={defaults.blockedCategories.includes(c)}
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
                    defaultChecked={defaults.blockedDrugCodes.includes(d.code)}
                  />
                  {d.name} <span className="text-text-muted">({CATEGORY_LABEL[d.category]})</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-semibold">초진 처방일수</legend>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" name="limitEnabled" defaultChecked={defaults.limitEnabled} />
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
                  defaultValue={defaults.maxDays}
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
                  defaultValue={defaults.extendedMaxDays}
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
                  defaultValue={defaults.extendedTimesPerPatient}
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
              defaultValue={defaults.note}
              placeholder="예: 원내 정책으로 이소트레티노인 비대면 처방 중단"
              className={inputClass}
            />
          </div>

          <button type="submit" className="rounded bg-accent px-4 py-2 font-semibold text-accent-contrast">
            영향 미리보기
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
                <th scope="col" className="px-3 py-2">이전 버전 대비</th>
              </tr>
            </thead>
            <tbody>
              {versions.map(({ rules: r, origin, savedAt, savedBy }, i) => {
                const previous = versions[i - 1]?.rules.version;
                return (
                  <tr key={r.version} className="border-b border-border align-top last:border-0">
                    <th scope="row" className="px-3 py-2 font-mono whitespace-nowrap">
                      {r.version}
                      {r.version === rules.version ? (
                        <span className="flex items-center gap-1 font-sans text-sm text-status-ok">
                          <Icon name="check" />
                          적용 중
                        </span>
                      ) : null}
                    </th>
                    <td className="px-3 py-2">
                      {origin === "file" ? "규칙 파일" : `${savedBy ?? "관리자"} · ${savedAt ? formatSeoul(savedAt) : ""}`}
                    </td>
                    <td className="px-3 py-2">{periodLabel(r.followUp.window)}</td>
                    <td className="px-3 py-2">{prescriptionSummary(r)}</td>
                    <td className="px-3 py-2">{r.source}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {previous ? (
                        <Link
                          href={`/admin/rules/impact?from=${previous}&to=${r.version}`}
                          className="text-accent underline"
                        >
                          {previous} → {r.version} 영향 보기
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-text-muted">관리자 화면에서 저장한 버전은 데모 초기화를 하면 지워져요.</p>
      </section>

      <section className="mt-8" aria-labelledby="reset-heading">
        <h2 id="reset-heading" className="text-xl font-bold">
          데모 초기화
        </h2>
        <p className="mt-1 text-text-muted">
          모든 요청을 검토 대기로 되돌려요. 다른 방문자가 남긴 결정을 지울 때 쓰세요.
        </p>
        {isAdmin ? (
          <form action={resetDemoAction} className="mt-2 space-y-3 rounded border border-border bg-surface p-4">
            <label className="flex items-start gap-2">
              <input type="checkbox" name="confirm" required className="mt-1.5" />
              <span>
                검토 결정, 감사 로그, 관리자가 저장한 규칙 버전이 지워지는 것을 확인했어요. (AI 제안은 남겨 둬요.)
              </span>
            </label>
            <button type="submit" className="rounded border border-status-danger px-4 py-2 font-semibold text-status-danger">
              데모 초기화
            </button>
          </form>
        ) : (
          <p className="mt-2 rounded border border-dashed border-border p-4">
            초기화는 관리자만 할 수 있어요. 화면 위에서 역할을 &ldquo;관리자&rdquo;로 바꾸세요.
          </p>
        )}
      </section>
    </>
  );
}
