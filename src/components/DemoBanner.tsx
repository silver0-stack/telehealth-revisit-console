import { Icon } from "./Icon";

// Required on every screen: all data in this app is synthetic. Rendered once in the root layout.
export function DemoBanner() {
  return (
    <div role="note" className="border-b border-border bg-banner-bg px-4 py-2 text-banner-text">
      <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 font-semibold">
        <Icon name="alert" />
        모든 데이터는 가상입니다
        <span className="font-normal">· 이 도구는 정보를 정리할 뿐, 최종 판단은 의사가 합니다.</span>
      </p>
    </div>
  );
}
