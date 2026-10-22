import { getRecordSource } from "@/data";

export default async function HomePage() {
  const source = getRecordSource();
  const [patients, requests] = await Promise.all([source.listPatients(), source.listRequests()]);
  const visitCounts = await Promise.all(patients.map((p) => source.listVisits(p.id).then((v) => v.length)));
  const requested = new Set(requests.map((r) => r.patientId));

  return (
    <>
      <h1 className="text-2xl font-bold">가상 환자 목록</h1>
      <p className="mt-1 text-text-muted">
        환자 {patients.length}명 · 비대면 진료 요청 {requests.length}건. 일반·초진 구분은 검토 화면(M3)에서 보여 줄 예정입니다.
      </p>

      <div className="mt-4 overflow-x-auto rounded border border-border bg-surface">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">가상 환자 목록</caption>
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className="px-3 py-2">환자 ID</th>
              <th scope="col" className="px-3 py-2">이름</th>
              <th scope="col" className="px-3 py-2">출생연도</th>
              <th scope="col" className="px-3 py-2">거주 시·도</th>
              <th scope="col" className="px-3 py-2 text-right">방문 기록</th>
              <th scope="col" className="px-3 py-2">비대면 요청</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p, i) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-mono">{p.id}</td>
                <td className="px-3 py-2">{p.displayName}</td>
                <td className="px-3 py-2">{p.birthYear}</td>
                <td className="px-3 py-2">{p.region}</td>
                <td className="px-3 py-2 text-right">{visitCounts[i]}건</td>
                <td className="px-3 py-2">{requested.has(p.id) ? "요청 있음" : "없음"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
