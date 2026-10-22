import Link from "next/link";
import { notFound } from "next/navigation";
import { formatSeoul } from "@/components/format";
import {
  ELIGIBILITY_TITLE,
  MATCH_LABEL_TEXT,
  notFollowUpText,
  regionText,
  REVIEW_ERROR_TEXT,
  REVIEW_STATUS,
  suggestionBadge,
} from "@/components/labels";
import { ProbabilityList } from "@/components/ProbabilityList";
import { StatusLine, type Tone } from "@/components/StatusLine";
import { getRecordSource } from "@/data";
import { KCD_NAMES } from "@/data/kcd";
import { getReview, getSuggestion } from "@/data/reviews";
import { getRules } from "@/data/rules";
import { toSeoulDate } from "@/domain/dates";
import type { EligibilityResult } from "@/domain/eligibility";
import { reviewAction } from "./actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const ELIGIBILITY_TONE: Record<EligibilityResult["kind"], Tone> = {
  follow_up: "ok",
  first_visit: "warn",
  not_allowed: "danger",
};

const DONE_TEXT: Record<string, string> = {
  approve: "승인했어요.",
  edit_approve: "수정하고 승인했어요.",
  hold: "보류했어요.",
};

const inputClass = "mt-1 block w-full rounded border border-border bg-surface px-3 py-2 text-text";
const buttonClass = "rounded px-4 py-2 font-semibold";

function kcdLabel(code: string): string {
  return `${code} ${KCD_NAMES[code] ?? ""}`.trim();
}

export default async function ReviewDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error, done } = await searchParams;
  const source = getRecordSource();
  const request = (await source.listRequests()).find((r) => r.id === id);
  if (!request) notFound();
  const patient = await source.getPatient(request.patientId);
  if (!patient) notFound();

  const visits = await source.listVisits(patient.id);
  const visitById = new Map(visits.map((v) => [v.id, v]));
  const { suggestion, candidates, minConfidence } = await getSuggestion(request, toSeoulDate(request.requestedAt));
  const review = getReview(request.id);
  const status = REVIEW_STATUS[review.state.status];
  const rules = getRules();
  const preselected = suggestion.kind === "preselect" ? suggestion.candidate : null;
  const shown = suggestion.kind === "preselect" ? suggestion.candidate : suggestion.kind === "needs_review" ? suggestion.best : null;

  return (
    <>
      <p>
        <Link href="/reviews" className="text-accent underline">
          ← 검토 목록
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold">
        {patient.displayName} 님의 비대면진료 요청 <span className="font-mono text-lg text-text-muted">{request.id}</span>
      </h1>
      <p className="mt-1">
        <span aria-hidden="true">{status.icon} </span>
        {status.text}
        {review.state.status === "held" ? ` · 이유: ${review.state.reason}` : null}
      </p>

      <div className="mt-4 space-y-3" aria-live="polite">
        {typeof done === "string" && DONE_TEXT[done] ? <StatusLine tone="ok" title={DONE_TEXT[done]} /> : null}
        {typeof error === "string" ? (
          <StatusLine tone="danger" title="처리하지 않았어요">
            {REVIEW_ERROR_TEXT[error as keyof typeof REVIEW_ERROR_TEXT] ?? "알 수 없는 오류예요. 다시 시도하세요."}
          </StatusLine>
        ) : null}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="request-heading" className="space-y-4">
          <h2 id="request-heading" className="text-xl font-bold">
            요청 내용
          </h2>
          <dl className="grid grid-cols-[7rem_1fr] gap-y-1 rounded border border-border bg-surface p-4">
            <dt className="font-semibold">오늘 증상</dt>
            <dd>&ldquo;{request.symptomText}&rdquo; (환자 표현)</dd>
            <dt className="font-semibold">요청 시각</dt>
            <dd>{formatSeoul(request.requestedAt)}</dd>
            <dt className="font-semibold">환자</dt>
            <dd>
              {patient.displayName} ({patient.id}, {patient.birthYear}년생, {patient.region}
              {patient.telehealthException ? `, 지역 예외: ${patient.telehealthException}` : ""})
            </dd>
          </dl>

          <h3 className="text-lg font-bold">이 의원 진료 기록</h3>
          {visits.length === 0 ? (
            <p className="rounded border border-dashed border-border p-4">
              진료 기록이 없어요. 오늘 증상의 진단 코드를 직접 고르면 초진으로 판단해요.
            </p>
          ) : (
            <div className="overflow-x-auto rounded border border-border bg-surface">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">진료 기록, 최근 것부터</caption>
                <thead className="border-b border-border">
                  <tr>
                    <th scope="col" className="px-3 py-2">날짜</th>
                    <th scope="col" className="px-3 py-2">방식</th>
                    <th scope="col" className="px-3 py-2">진단</th>
                    <th scope="col" className="px-3 py-2">기록</th>
                  </tr>
                </thead>
                <tbody>
                  {[...visits]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((v) => (
                      <tr key={v.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 whitespace-nowrap">{v.date}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {v.mode === "in_person" ? "대면" : "비대면 (재진 근거 아님)"}
                        </td>
                        <td className="px-3 py-2">{kcdLabel(v.kcdCode)}</td>
                        <td className="px-3 py-2">{v.note}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="suggestion-heading" className="space-y-4">
          <h2 id="suggestion-heading" className="text-xl font-bold">
            증상 비교 제안
          </h2>
          <div className="rounded border border-border bg-surface p-4">
            {shown ? (
              <p className="mb-3 inline-block rounded border border-accent px-2 py-0.5 text-sm font-semibold text-accent">
                {suggestionBadge(shown.match.matcher)}
              </p>
            ) : null}

            {suggestion.kind === "no_candidates" ? (
              <StatusLine tone="warn" title="비교할 대면 진료 기록이 없어요">
                오늘 증상의 진단 코드를 직접 고르고 &ldquo;수정하고 승인&rdquo;을 누르세요.
              </StatusLine>
            ) : suggestion.kind === "preselect" ? (
              <StatusLine tone="ok" title={`이전 진료와 같은 증상으로 보여요: ${kcdLabel(suggestion.candidate.kcdCode)}`}>
                {visitById.get(suggestion.candidate.visitId)?.date} 대면 진료와 비교했어요. 맞으면 &ldquo;승인&rdquo;, 다르면
                &ldquo;수정하고 승인&rdquo;을 누르세요.
              </StatusLine>
            ) : (
              <StatusLine tone="warn" title="의사 확인 필요">
                확실한 제안이 없어서 미리 고르지 않았어요 (기준: 같은 증상 확률 {Math.round(minConfidence * 100)}% 이상).
                진단 코드를 직접 고르세요.
              </StatusLine>
            )}

            {candidates.length > 0 ? (
              <ul className="mt-4 space-y-4">
                {candidates.map((c) => (
                  <li key={c.visitId} className="border-t border-border pt-3">
                    <p className="font-semibold">
                      {visitById.get(c.visitId)?.date} 대면 · {kcdLabel(c.kcdCode)}
                      <span className="font-normal text-text-muted"> → {MATCH_LABEL_TEXT[c.match.label]}</span>
                    </p>
                    <div className="mt-1">
                      <ProbabilityList probabilities={c.match.probabilities} top={c.match.label} />
                    </div>
                    {c.match.explanation ? <p className="mt-1 text-text-muted">{c.match.explanation}</p> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {shown ? (
              <p className="mt-3 text-sm text-text-muted">
                판단 도구: {shown.match.matcher.id} ({shown.match.matcher.version})
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section aria-labelledby="decision-heading" className="mt-8">
        <h2 id="decision-heading" className="text-xl font-bold">
          의사 결정
        </h2>
        {review.state.status === "approved" && review.eligibility ? (
          <div className="mt-2 space-y-3">
            <p>
              확정한 진단: <strong>{kcdLabel(review.state.kcdCode)}</strong>
              {review.state.editedSuggestion ? " (직접 선택)" : " (제안 승인)"}
            </p>
            <StatusLine tone={ELIGIBILITY_TONE[review.eligibility.kind]} title={ELIGIBILITY_TITLE[review.eligibility.kind]}>
              {review.eligibility.kind === "follow_up" ? (
                <p>
                  {visitById.get(review.eligibility.evidenceVisitId)?.date} 같은 증상 대면 진료 기록이 있어요.{" "}
                  {review.eligibility.windowEnd}까지 재진으로 볼 수 있어요.
                </p>
              ) : (
                <p>
                  {notFollowUpText(review.eligibility.notFollowUp, rules.followUp.window)}{" "}
                  {regionText(review.eligibility.region, patient.region)}
                </p>
              )}
              <p className="mt-1 text-text-muted">규칙 {review.eligibility.ruleVersion} 기준</p>
            </StatusLine>
            {review.eligibility.kind !== "not_allowed" ? (
              <Link
                href={`/prescriptions?patientId=${patient.id}&kcd=${encodeURIComponent(review.state.kcdCode)}`}
                className="inline-block rounded bg-accent px-4 py-2 font-semibold text-accent-contrast"
              >
                처방 확인으로 이동
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="mt-2 grid gap-4 md:grid-cols-3">
            <form action={reviewAction} className="rounded border border-border bg-surface p-4">
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="intent" value="approve" />
              <h3 className="font-semibold">제안대로</h3>
              <p className="mt-1 text-text-muted">
                {preselected ? `${kcdLabel(preselected.kcdCode)}로 확정해요.` : "미리 고른 제안이 없어서 쓸 수 없어요."}
              </p>
              <button
                type="submit"
                disabled={!preselected}
                className={`${buttonClass} mt-3 bg-accent text-accent-contrast disabled:cursor-not-allowed disabled:opacity-50`}
              >
                승인
              </button>
            </form>

            <form action={reviewAction} className="rounded border border-border bg-surface p-4">
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="intent" value="edit_approve" />
              <label htmlFor="kcdCode" className="font-semibold">
                진단 코드 직접 고르기
              </label>
              <select id="kcdCode" name="kcdCode" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  코드를 고르세요
                </option>
                {Object.entries(KCD_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} {name}
                  </option>
                ))}
              </select>
              <button type="submit" className={`${buttonClass} mt-3 bg-accent text-accent-contrast`}>
                수정하고 승인
              </button>
            </form>

            <form action={reviewAction} className="rounded border border-border bg-surface p-4">
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="intent" value="hold" />
              <label htmlFor="reason" className="font-semibold">
                보류 이유
              </label>
              <input
                id="reason"
                name="reason"
                required
                maxLength={200}
                placeholder="예: 환자에게 증상 추가 확인 필요"
                className={inputClass}
              />
              <button type="submit" className={`${buttonClass} mt-3 border border-border bg-surface text-text`}>
                보류
              </button>
            </form>
          </div>
        )}
      </section>
    </>
  );
}
