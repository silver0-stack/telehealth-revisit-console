import { setBannerAction } from "@/app/banner-actions";
import { Icon } from "./Icon";

// Required on every screen: all data in this app is synthetic. The full banner can be folded into
// a small badge in the header (DemoBadge), but one of the two is always shown.
// Plain forms with a server action, so folding works without JavaScript.
export function DemoBanner() {
  return (
    <div role="note" className="border-b border-border bg-banner-bg px-4 py-2 text-banner-text">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-3">
        <p className="flex flex-wrap items-center gap-x-2 font-semibold">
          <Icon name="alert" />
          모든 데이터는 가상입니다
          <span className="font-normal">· 이 도구는 정보를 정리할 뿐, 최종 판단은 의사가 합니다.</span>
        </p>
        <form action={setBannerAction}>
          <input type="hidden" name="collapsed" value="1" />
          <button type="submit" aria-label="안내 접기" title="안내 접기" className="rounded p-1 hover:bg-banner-text/10">
            <Icon name="x" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function DemoBadge() {
  return (
    <form action={setBannerAction}>
      <input type="hidden" name="collapsed" value="0" />
      <button
        type="submit"
        title="모든 데이터는 가상입니다. 누르면 안내를 펼쳐요."
        className="flex items-center gap-1 rounded border border-banner-text/30 bg-banner-bg px-2 py-0.5 text-sm font-semibold text-banner-text"
      >
        <Icon name="alert" />
        가상 데이터
      </button>
    </form>
  );
}
