import Link from "next/link";
import { connection } from "next/server";
import { readSandbox } from "@/app/sandbox";
import { formatSeoul } from "@/components/format";
import { Icon } from "@/components/Icon";
import { ELIGIBILITY_SHORT } from "@/components/labels";
import { getRecordSource } from "@/data";
import { listReviews } from "@/data/reviews";
import { getRules } from "@/data/rules";
import type { EligibilityResult } from "@/domain/eligibility";

const NEXT_UP = 5;

export default async function HomePage() {
  // Review state lives in the store and changes per request, so this page is never prerendered.
  await connection();
  const source = getRecordSource();
  const sandbox = await readSandbox();
  const [patients, requests, reviews, rules] = await Promise.all([
    source.listPatients(),
    source.listRequests(),
    listReviews(sandbox),
    getRules(sandbox),
  ]);
  const nameById = new Map(patients.map((p) => [p.id, p.displayName]));

  // Only stored decisions are counted here. Suggestions are not computed on this page, so opening it
  // never calls the AI matcher.
  const statusOf = (id: string) => reviews.get(id)?.state.status ?? "pending";
  const pending = requests.filter((r) => statusOf(r.id) === "pending");
  const heldCount = requests.filter((r) => statusOf(r.id) === "held").length;
  const outcomes: Record<EligibilityResult["kind"], number> = { follow_up: 0, first_visit: 0, not_allowed: 0 };
  for (const review of reviews.values()) if (review.eligibility) outcomes[review.eligibility.kind] += 1;
  const approvedCount = outcomes.follow_up + outcomes.first_visit + outcomes.not_allowed;
  // Oldest first: the patient who has waited longest is the one to review next.
  const nextUp = [...pending].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)).slice(0, NEXT_UP);

  return (
    <>
      <h1 className="text-2xl font-bold">오늘 할 일</h1>
      <p className="mt-1 text-text-muted">비대면진료 요청 {requests.length}건 · 규칙 {rules.version}</p>

      <section aria-labelledby="summary-heading" className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <h2 id="summary-heading" className="sr-only">
          검토 현황
        </h2>
        <dl className="grid grid-cols-3 divide-x divide-border self-start rounded border border-border bg-surface">
          <div className="p-4">
            <dt className="text-text-muted">검토 대기</dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums text-accent">{pending.length}</dd>
          </div>
          <div className="p-4">
            <dt className="text-text-muted">보류</dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums">{heldCount}</dd>
          </div>
          <div className="p-4">
            <dt className="text-text-muted">승인</dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums">{approvedCount}</dd>
            <dd className="mt-1 text-sm text-text-muted">
              {(Object.keys(outcomes) as EligibilityResult["kind"][])
                .map((k) => `${ELIGIBILITY_SHORT[k]} ${outcomes[k]}`)
                .join(" · ")}
            </dd>
          </div>
        </dl>

        <div className="rounded border border-border bg-surface">
          <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-2">
            <h2 className="font-bold">
              다음 검토 <span className="text-sm font-normal text-text-muted">오래 기다린 순</span>
            </h2>
            <Link href="/reviews" className="inline-flex items-center gap-1 text-accent underline">
              전체 {requests.length}건
              <Icon name="arrow-right" />
            </Link>
          </div>
          {nextUp.length === 0 ? (
            <p className="px-4 py-3 text-text-muted">검토 대기 중인 요청이 없어요.</p>
          ) : (
            <ul className="divide-y divide-border">
              {nextUp.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/reviews/${r.id}`}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 px-4 py-2 hover:bg-bg sm:grid-cols-[9rem_6rem_minmax(0,1fr)]"
                  >
                    <span className="tabular-nums text-text-muted">{formatSeoul(r.requestedAt)}</span>
                    <span className="font-semibold text-accent">{nameById.get(r.patientId)}</span>
                    <span className="col-span-2 truncate sm:col-span-1">&ldquo;{r.symptomText}&rdquo;</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
