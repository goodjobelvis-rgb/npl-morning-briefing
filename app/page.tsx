import { Suspense } from "react";
import { connection } from "next/server";
import { getTodaysBriefing } from "@/lib/briefing/today";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function kstLabel(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const time = kst.toISOString().slice(11, 16);
  return `${kst.toISOString().slice(0, 10)} (${WEEKDAYS[kst.getUTCDay()]}) ${time} 기준`;
}

async function BriefingPopup() {
  await connection(); // 빌드 때가 아니라 열 때 만든다.

  let briefing;
  try {
    briefing = await getTodaysBriefing();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-5 text-red-900">
        <p className="font-semibold">오늘 브리핑을 만들지 못했습니다.</p>
        <p className="mt-2 text-sm break-words">{message}</p>
        <p className="mt-2 text-sm">잠시 뒤 새로고침하면 다시 시도합니다.</p>
      </div>
    );
  }

  if (briefing.items.length === 0) {
    return <p className="rounded-xl border p-5">오늘은 관련 소식이 없습니다.</p>;
  }

  return (
    <ol className="space-y-4">
      {briefing.items.map((item, index) => (
        <li key={`${index}-${item.title}`} className="rounded-xl border border-black/10 p-5 shadow-sm dark:border-white/15">
          <h2 className="text-lg font-semibold leading-snug">
            {item.isFsc && (
              <span className="mr-2 rounded bg-blue-600 px-2 py-0.5 align-middle text-xs font-medium text-white">
                금융위
              </span>
            )}
            {item.title}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            {item.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            {item.links.map((link, n) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-3 text-blue-600 underline underline-offset-2 dark:text-blue-400"
              >
                원문 {n + 1}
              </a>
            ))}
          </p>
        </li>
      ))}
      <li className="list-none text-xs opacity-60">
        {kstLabel(briefing.generatedAt)} · 금융위 {briefing.collected.fsc}건, 뉴스 {briefing.collected.news}건 수집
      </li>
    </ol>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">NPL 모닝브리핑</h1>
      <p className="mt-1 mb-6 text-sm opacity-70">
        금융위원회 보도자료와 뉴스에서 NPL·부실채권·신용채권 소식을 모아 정리했어요.
      </p>
      <Suspense
        fallback={
          <p className="rounded-xl border p-5 text-sm">브리핑을 만드는 중입니다. 약 1분 걸려요…</p>
        }
      >
        <BriefingPopup />
      </Suspense>
    </main>
  );
}
