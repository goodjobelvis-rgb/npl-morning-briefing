import { buildBriefing } from "@/lib/briefing";

// 수집 + AI 요약까지 시간이 걸리므로 넉넉히 둔다(초).
export const maxDuration = 300;

// M1 확인용: 오늘 브리핑을 JSON으로 돌려준다.
// PRD 7) 아무나 실행하지 못하도록 CRON_SECRET 토큰을 확인한다.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    return Response.json(await buildBriefing());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[briefing]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
