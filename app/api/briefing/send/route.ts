import { buildBriefing } from "@/lib/briefing";
import { renderBriefingEmail, renderErrorEmail, sendEmail } from "@/lib/briefing/mail";

export const maxDuration = 300;

// M2: 브리핑을 만들어 메일로 보낸다. 평일 아침 8시(한국 시간)에 Vercel Cron이 호출한다.
// Vercel Cron은 CRON_SECRET이 있으면 Authorization: Bearer <값>을 자동으로 붙여 보낸다.
// ?dryRun=1 이면 메일을 보내지 않고 만들어진 메일 내용만 돌려준다.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  // 실패하면 1번 다시 시도하고, 그래도 실패하면 오류 안내 메일을 보낸다.
  let email;
  try {
    email = renderBriefingEmail(await buildBriefing().catch(() => buildBriefing()));
  } catch (error) {
    console.error("[briefing/send]", error);
    email = renderErrorEmail(error);
  }

  if (dryRun) return Response.json({ dryRun: true, ...email });

  try {
    await sendEmail(email);
    return Response.json({ sent: true, subject: email.subject });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[briefing/send] 메일 발송 실패:", message);
    return Response.json({ sent: false, error: message }, { status: 500 });
  }
}
