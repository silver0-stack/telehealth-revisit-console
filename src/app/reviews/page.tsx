import Link from "next/link";
import { connection } from "next/server";
import { formatSeoul } from "@/components/format";
import { ELIGIBILITY_TITLE, REVIEW_STATUS } from "@/components/labels";
import { getRecordSource } from "@/data";
import { listReviews, type ReviewRecord } from "@/data/reviews";

const STATUS_ORDER = { pending: 0, held: 1, approved: 2 } as const;
const PENDING: ReviewRecord = { state: { status: "pending" }, eligibility: null };

export default async function ReviewsPage() {
  // In-memory review state changes per request, so this page must never be prerendered at build time.
  await connection();
  const source = getRecordSource();
  const [requests, patients, reviews] = await Promise.all([source.listRequests(), source.listPatients(), listReviews()]);
  const nameById = new Map(patients.map((p) => [p.id, p.displayName]));

  // Undecided work first, then by request time, so the top of the list is what needs attention.
  const rows = requests
    .map((r) => ({ request: r, review: reviews.get(r.id) ?? PENDING }))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.review.state.status] - STATUS_ORDER[b.review.state.status] ||
        a.request.requestedAt.localeCompare(b.request.requestedAt),
    );
  const pendingCount = rows.filter((r) => r.review.state.status === "pending").length;

  return (
    <>
      <h1 className="text-2xl font-bold">비대면진료 요청 검토</h1>
      <p className="mt-1 text-text-muted">
        요청 {rows.length}건 · 검토 대기 {pendingCount}건
      </p>

      <div className="mt-4 overflow-x-auto rounded border border-border bg-surface">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">비대면진료 요청 목록, 검토 대기 먼저</caption>
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className="px-3 py-2">상태</th>
              <th scope="col" className="px-3 py-2">요청 시각</th>
              <th scope="col" className="px-3 py-2">환자</th>
              <th scope="col" className="px-3 py-2">오늘 증상 (환자 표현)</th>
              <th scope="col" className="px-3 py-2">결과</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ request, review }) => {
              const status = REVIEW_STATUS[review.state.status];
              return (
                <tr key={request.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span aria-hidden="true">{status.icon} </span>
                    {status.text}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatSeoul(request.requestedAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/reviews/${request.id}`} className="text-accent underline">
                      {nameById.get(request.patientId) ?? request.patientId}
                      <span className="sr-only"> 요청 검토하기</span>
                    </Link>{" "}
                    <span className="font-mono text-text-muted">{request.patientId}</span>
                  </td>
                  <td className="px-3 py-2">&ldquo;{request.symptomText}&rdquo;</td>
                  <td className="px-3 py-2">{review.eligibility ? ELIGIBILITY_TITLE[review.eligibility.kind] : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
