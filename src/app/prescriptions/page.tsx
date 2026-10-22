import Link from "next/link";
import { z } from "zod";
import { CATEGORY_LABEL, ELIGIBILITY_TITLE, notFollowUpText, prescriptionText, regionText } from "@/components/labels";
import { StatusLine, type Tone } from "@/components/StatusLine";
import { getRecordSource } from "@/data";
import { CLINIC } from "@/data/clinic";
import { DRUGS, findDrug } from "@/data/drugs";
import { KCD_NAMES } from "@/data/kcd";
import { getRules } from "@/data/rules";
import { checkEligibility, type EligibilityResult } from "@/domain/eligibility";
import { checkPrescription } from "@/domain/prescription";
import { DrugSchema, PatientSchema } from "@/domain/types";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// The form submits with GET, so the URL is the whole state: results can be bookmarked and the page
// works without JavaScript. Values are validated here because a URL can contain anything.
const QuerySchema = z.object({
  patientId: PatientSchema.shape.id,
  kcd: z.string().refine((k) => k in KCD_NAMES, "unknown KCD code"),
  drug: DrugSchema.shape.code,
  days: z.coerce.number().int().min(1).max(365),
  continuing: z.literal("on").optional(),
  history: z.literal("on").optional(),
});

const FIELD_LABEL: Record<string, string> = {
  patientId: "환자",
  kcd: "오늘 증상",
  drug: "약",
  days: "처방일수 (1~365일)",
};

const ELIGIBILITY_TONE: Record<EligibilityResult["kind"], Tone> = {
  follow_up: "ok",
  first_visit: "warn",
  not_allowed: "danger",
};

const inputClass = "mt-1 block w-full rounded border border-border bg-surface px-3 py-2 text-text";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PrescriptionsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, first(v)]));
  const submitted = query.patientId !== undefined;
  const parsed = submitted ? QuerySchema.safeParse(query) : null;

  const source = getRecordSource();
  const [patients, today] = await Promise.all([source.listPatients(), source.getToday()]);
  const rules = getRules();

  return (
    <>
      <h1 className="text-2xl font-bold">처방 확인</h1>
      <p className="mt-1 text-text-muted">
        비대면진료 요청이 일반(재진)인지 초진인지, 그리고 처방하려는 약과 일수가 규칙에 맞는지 확인해요. 기준일{" "}
        {today} · 규칙 {rules.version}
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <form action="/prescriptions" method="get" className="space-y-4 rounded border border-border bg-surface p-4">
          <div>
            <label htmlFor="patientId" className="font-semibold">
              환자
            </label>
            <select id="patientId" name="patientId" defaultValue={query.patientId ?? ""} required className={inputClass}>
              <option value="" disabled>
                환자를 고르세요
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} {p.displayName} ({p.region})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="kcd" className="font-semibold">
              오늘 증상 (의사가 확인한 진단 코드)
            </label>
            <select id="kcd" name="kcd" defaultValue={query.kcd ?? ""} required className={inputClass}>
              <option value="" disabled>
                증상을 고르세요
              </option>
              {Object.entries(KCD_NAMES).map(([code, name]) => (
                <option key={code} value={code}>
                  {code} {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="drug" className="font-semibold">
              약
            </label>
            <select id="drug" name="drug" defaultValue={query.drug ?? ""} required className={inputClass}>
              <option value="" disabled>
                약을 고르세요
              </option>
              {DRUGS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name} · {d.use} ({CATEGORY_LABEL[d.category]})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="days" className="font-semibold">
              처방일수
            </label>
            <input
              id="days"
              name="days"
              type="number"
              min={1}
              max={365}
              required
              defaultValue={query.days ?? "7"}
              className={inputClass}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="font-semibold">초진 예외(최대 30일, 1회)를 쓸 때만 확인</legend>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="continuing" defaultChecked={query.continuing === "on"} className="mt-1.5" />
              기존 치료를 계속해야 한다고 판단함 (의사)
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="history" defaultChecked={query.history === "on"} className="mt-1.5" />
              해당 질환의 진료·처방 이력을 확인함
            </label>
          </fieldset>
          <button type="submit" className="rounded bg-accent px-4 py-2 font-semibold text-accent-contrast">
            확인
          </button>
        </form>

        <section aria-labelledby="result-heading" aria-live="polite">
          <h2 id="result-heading" className="sr-only">
            확인 결과
          </h2>
          {!submitted ? (
            <p className="rounded border border-dashed border-border p-4 text-text-muted">
              왼쪽에서 환자, 증상, 약, 처방일수를 고르고 &ldquo;확인&rdquo;을 누르면 결과가 여기에 나와요.
            </p>
          ) : parsed && !parsed.success ? (
            <StatusLine tone="danger" title="입력을 확인해 주세요">
              <ul className="list-disc pl-5">
                {[...new Set(parsed.error.issues.map((i) => String(i.path[0])))].map((field) => (
                  <li key={field}>{FIELD_LABEL[field] ?? field} 값이 올바르지 않아요. 다시 골라 주세요.</li>
                ))}
              </ul>
            </StatusLine>
          ) : parsed ? (
            <Result query={parsed.data} today={today} />
          ) : null}
        </section>
      </div>
    </>
  );
}

async function Result({ query, today }: { query: z.infer<typeof QuerySchema>; today: string }) {
  const source = getRecordSource();
  const patient = await source.getPatient(query.patientId);
  const drug = findDrug(query.drug);
  if (!patient || !drug) {
    return (
      <StatusLine tone="danger" title="환자나 약을 찾을 수 없어요">
        목록에서 다시 골라 주세요. 데모 데이터를 다시 만들었다면 페이지를 새로 고치세요.
      </StatusLine>
    );
  }

  const rules = getRules();
  const [visits, history] = await Promise.all([source.listVisits(patient.id), source.listPrescriptions(patient.id)]);
  const eligibility = checkEligibility(
    {
      patient,
      clinicRegion: CLINIC.region,
      requestedAt: `${today}T09:00:00+09:00`,
      symptomKcdCode: query.kcd,
      visits,
    },
    rules,
  );
  const rx = checkPrescription(
    {
      eligibility: eligibility.kind,
      drug,
      days: query.days,
      continuingTreatment: query.continuing === "on",
      historyConfirmed: query.history === "on",
      history,
    },
    rules,
  );

  const evidence = eligibility.kind === "follow_up" ? visits.find((v) => v.id === eligibility.evidenceVisitId) : undefined;
  const extensionUsed = history.find((r) => r.usedFirstVisitExtension);
  const sameDrugHistory = history.filter((r) => r.drugCode === drug.code);

  return (
    <div className="space-y-4">
      <StatusLine tone={ELIGIBILITY_TONE[eligibility.kind]} title={ELIGIBILITY_TITLE[eligibility.kind]}>
        {eligibility.kind === "follow_up" ? (
          <p>
            {evidence?.date} 같은 증상({query.kcd} {KCD_NAMES[query.kcd]})으로 대면 진료한 기록이 있어요.{" "}
            {eligibility.windowEnd}까지 재진으로 볼 수 있어요.
          </p>
        ) : (
          <p>
            {notFollowUpText(eligibility.notFollowUp, rules.followUp.window)} {regionText(eligibility.region, patient.region)}
          </p>
        )}
      </StatusLine>

      <StatusLine
        tone={rx.result === "allowed" ? "ok" : "danger"}
        title={`${drug.name} ${query.days}일 · ${rx.result === "allowed" ? "규칙상 차단 없음" : "규칙상 차단"}`}
      >
        <p>{prescriptionText(rx, CATEGORY_LABEL[drug.category], extensionUsed?.date ?? null)}</p>
        {/* The check covers telehealth rules only; it must never read as approval of the prescription itself. */}
        <p className="mt-1 text-text-muted">용량과 기간이 적절한지는 의사가 판단해요.</p>
      </StatusLine>

      <div className="rounded border border-border bg-surface p-4">
        <h3 className="font-semibold">이력 확인에 참고할 기록 ({patient.displayName})</h3>
        <ul className="mt-2 list-disc pl-5">
          <li>
            같은 약 처방 기록:{" "}
            {sameDrugHistory.length === 0
              ? "없음"
              : sameDrugHistory.map((r) => `${r.date} ${r.days}일`).join(", ")}
          </li>
          <li>초진 예외(30일) 사용: {extensionUsed ? `사용함 (${extensionUsed.date})` : "사용 기록 없음"}</li>
        </ul>
        <p className="mt-2 text-text-muted">
          데모 기록만 보여요. 실제로는 다른 의료기관의 기록까지 비대면진료지원시스템에서 확인해야 해요.
        </p>
      </div>

      <p className="text-text-muted">
        규칙 {rx.ruleVersion} 기준의 점검 결과예요. 진단과 처방은 의사가 결정해요.{" "}
        <Link href="/admin/rules" className="text-accent underline">
          규칙 보기
        </Link>
      </p>
    </div>
  );
}
