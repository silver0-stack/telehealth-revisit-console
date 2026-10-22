"use client";

// Shown when a page throws. Says what happened and what to do, without hiding the cause.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="border-l-4 border-status-danger bg-surface px-4 py-3">
      <p className="font-bold text-status-danger">
        <span aria-hidden="true">✕ </span>이 화면을 보여 주지 못했어요
      </p>
      <p className="mt-1">원인: {error.message}</p>
      <p className="mt-1">다시 시도해도 같으면 서버 로그에서 위 내용을 확인하세요.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded bg-accent px-4 py-2 font-semibold text-accent-contrast"
      >
        다시 시도
      </button>
    </div>
  );
}
