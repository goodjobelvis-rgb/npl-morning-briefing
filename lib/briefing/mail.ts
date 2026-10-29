import "server-only";
import nodemailer from "nodemailer";
import type { Briefing } from "./types";

export type Email = { subject: string; html: string; text: string };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 한국 시간 기준 "YYYY-MM-DD (요일)"
function kstDateLabel(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 10)} (${WEEKDAYS[kst.getUTCDay()]})`;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// PRD 5) M2 규칙: 제목은 "[NPL 모닝브리핑] YYYY-MM-DD (요일) · N건", 0건인 날도 메일을 보낸다.
export function renderBriefingEmail(briefing: Briefing): Email {
  const date = kstDateLabel(new Date(briefing.generatedAt));
  const count = briefing.items.length;
  const subject = `[NPL 모닝브리핑] ${date} · ${count}건`;

  if (count === 0) {
    const message = "오늘은 관련 소식이 없습니다.";
    return {
      subject,
      text: message,
      html: `<p style="font:16px/1.6 sans-serif">${message}</p>`,
    };
  }

  const text = briefing.items
    .map((item, i) =>
      [
        `${i + 1}. ${item.isFsc ? "[금융위] " : ""}${item.title}`,
        ...item.summary.map((line) => `  - ${line}`),
        ...item.links.map((link) => `  ${link}`),
      ].join("\n"),
    )
    .join("\n\n");

  const html = `<div style="font:15px/1.6 -apple-system,'Malgun Gothic',sans-serif;max-width:640px;color:#222">
<h2 style="margin:0 0 16px">NPL 모닝브리핑 · ${escapeHtml(date)}</h2>
${briefing.items
  .map(
    (item, i) => `<div style="margin:0 0 20px;padding:0 0 16px;border-bottom:1px solid #eee">
<div style="font-weight:700;font-size:16px">${i + 1}. ${item.isFsc ? '<span style="color:#1a56db">[금융위]</span> ' : ""}${escapeHtml(item.title)}</div>
<ul style="margin:6px 0 8px;padding-left:20px">${item.summary.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
<div style="font-size:13px">${item.links
      .map((link, n) => `<a href="${escapeHtml(link)}">원문 ${n + 1}</a>`)
      .join(" · ")}</div>
</div>`,
  )
  .join("\n")}
</div>`;

  return { subject, html, text };
}

export function renderErrorEmail(error: unknown, now = new Date()): Email {
  const message = error instanceof Error ? error.message : String(error);
  return {
    subject: `[NPL 모닝브리핑] ${kstDateLabel(now)} · 발송 실패`,
    text: `오늘 브리핑을 만들지 못했습니다.\n\n${message}`,
    html: `<p style="font:16px/1.6 sans-serif">오늘 브리핑을 만들지 못했습니다.</p><pre style="white-space:pre-wrap">${escapeHtml(message)}</pre>`,
  };
}

// 개인 Gmail에서 앱 비밀번호로 보낸다. (MAIL_USER=보내는 Gmail, MAIL_TO=받는 주소)
export async function sendEmail(email: Email): Promise<void> {
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_APP_PASSWORD;
  const to = process.env.MAIL_TO;
  if (!user || !pass || !to) {
    throw new Error(".env에 MAIL_USER, MAIL_APP_PASSWORD, MAIL_TO를 넣어 주세요.");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  await transporter.sendMail({ from: user, to, ...email });
}
