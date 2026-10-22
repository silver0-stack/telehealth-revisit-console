import Link from "next/link";
import { connection } from "next/server";
import { describeChange } from "@/components/audit-change";
import { formatSeoul } from "@/components/format";
import { AUDIT_ACTION_TEXT, MATCH_LABEL_TEXT } from "@/components/labels";
import { listAuditEvents } from "@/data/audit-log";
import type { AuditEvent } from "@/domain/audit";

function suggestionSummary(s: AuditEvent["suggestion"]): string {
  if (!s) return "—";
  if (s.outcome === "no_candidates") return "비교할 기록 없음";
  const p = s.probabilities;
  const probs = p
    ? ` (같음 ${Math.round(p.same * 100)}% · 관련 ${Math.round(p.related * 100)}% · 다름 ${Math.round(p.different * 100)}%)`
    : "";
  const label = s.label ? MATCH_LABEL_TEXT[s.label] : "";
  const head = s.outcome === "preselect" ? "미리 선택" : "의사 확인 필요";
  return `${head}: ${s.kcdCode ?? ""} ${label}${probs}`;
}

function ChangeSummary({ event }: { event: AuditEvent }) {
  const rows = describeChange(event);
  return (
    <>
      {rows === null ? (
        <p className="text-text-muted">요약할 수 없는 형식이에요. 원본을 확인하세요.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="font-semibold whitespace-nowrap">{r.label}</dt>
              <dd>{r.before === null ? r.after : `${r.before} → ${r.after}`}</dd>
            </div>
          ))}
        </dl>
      )}
      <details className="mt-1">
        <summary className="cursor-pointer text-accent underline">원본 보기</summary>
        <pre className="mt-2 max-w-md overflow-x-auto whitespace-pre-wrap font-mono text-sm">
          {JSON.stringify({ before: event.before, after: event.after }, null, 2)}
        </pre>
      </details>
    </>
  );
}

export default async function AuditPage() {
  // In-memory state changes per request, so this page must never be prerendered at build time.
  await connection();
  const events = await listAuditEvents();
  return (
    <>
      <h1 className="text-2xl font-bold">감사 로그</h1>
      <p className="mt-1 text-text-muted">
        사람이 내린 결정은 모두 여기에 남아요. 고치거나 지울 수 없어요. 최근 것부터 보여요.
      </p>

      {events.length === 0 ? (
        <p className="mt-4 rounded border border-dashed border-border p-4">
          아직 기록이 없어요.{" "}
          <Link href="/reviews" className="text-accent underline">
            검토 화면
          </Link>
          에서 요청을 승인하거나 보류하면, 또는 규칙을 새 버전으로 저장하면 여기에 기록돼요.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded border border-border bg-surface">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">감사 로그, 최근 것부터</caption>
            <thead className="border-b border-border">
              <tr>
                <th scope="col" className="px-3 py-2">시각</th>
                <th scope="col" className="px-3 py-2">누가</th>
                <th scope="col" className="px-3 py-2">동작</th>
                <th scope="col" className="px-3 py-2">대상</th>
                <th scope="col" className="px-3 py-2">자동 제안 (판단 도구)</th>
                <th scope="col" className="px-3 py-2">결정</th>
                <th scope="col" className="px-3 py-2">바뀐 내용</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">{formatSeoul(e.at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{e.actor}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{AUDIT_ACTION_TEXT[e.action]}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.subject.type === "request" ? (
                      <Link href={`/reviews/${e.subject.id}`} className="font-mono text-accent underline">
                        {e.subject.id}
                      </Link>
                    ) : e.subject.type === "rules" ? (
                      <span className="font-mono">규칙 {e.subject.id}</span>
                    ) : (
                      "데모 전체"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {suggestionSummary(e.suggestion)}
                    {e.suggestion?.matcher ? (
                      <span className="block text-sm text-text-muted">
                        {e.suggestion.matcher.id} {e.suggestion.matcher.version} · 기준 {e.suggestion.minConfidence}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{e.decision ?? "—"}</td>
                  <td className="px-3 py-2">
                    <ChangeSummary event={e} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-text-muted">데모에서는 서버를 다시 켜면 기록이 사라져요. 실제로는 지울 수 없는 저장소에 보관해야 해요.</p>
    </>
  );
}
