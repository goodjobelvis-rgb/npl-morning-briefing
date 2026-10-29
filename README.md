# NPL 모닝브리핑

평일 오전 8시에 금융위원회 보도자료와 뉴스에서 **NPL(부실채권)·신용채권** 소식을 모아, AI로 정리해 이메일로 보내 주는 1인용 앱입니다.

매일 여러 사이트를 돌며 30분씩 찾던 시장 동향을, 아침 메일 한 통(5분 이내)으로 끝내는 것이 목표입니다.

## 무엇을 하나요

1. **수집:** 금융위원회 보도자료와 구글·빙 뉴스 RSS에서 키워드(NPL, 부실채권, 신용채권)로 지난 24시간 기사를 모읍니다.
2. **AI 정리:** 관련 없는 기사를 거르고, 같은 소식은 1건으로 묶고, 기사마다 3줄 이내로 요약합니다. 금융위 보도자료를 맨 위에 두고 최대 10건만 보여 줍니다.
3. **메일 발송:** `[NPL 모닝브리핑] YYYY-MM-DD (요일) · N건` 제목으로 보냅니다. 소식이 없는 날에도 "오늘은 관련 소식이 없습니다" 메일을 보내고, 실패하면 1번 다시 시도한 뒤 오류 안내 메일을 보냅니다.

## 현재 상태

- 수집과 AI 정리, 확인용 웹페이지(첫 화면)는 실제로 동작합니다.
- 이메일 발송 코드는 구현되어 있지만, Gmail 앱 비밀번호 인증 문제로 실제 발송은 아직 확인하지 못했습니다.
- 확인용 웹페이지는 열면 AI 요약이 실행됩니다(결과는 1시간 보관).

## 문서

- [PRD.md](PRD.md): 기획서 (문제 정의, 성공 기준, 범위·비범위, 보안 검토)
- [PLAN.md](PLAN.md): 구현 계획 (처리 흐름, 구현 단계, 배포 전후 할 일)
- [REPORT.md](REPORT.md): 기획 보고서

## 구조

| 경로 | 역할 |
|---|---|
| `lib/briefing/sources/` | 금융위 보도자료·뉴스 RSS 수집 |
| `lib/briefing/summarize.ts` | OpenAI로 거르기·묶기·요약 |
| `lib/briefing/mail.ts` | 메일 만들기와 Gmail 발송 |
| `app/api/briefing/send` | 발송 API (Vercel Cron이 호출, `?dryRun=1`이면 미리 보기) |
| `app/page.tsx` | 오늘 브리핑을 보여 주는 확인용 화면 |
| `vercel.json` | 자동 발송 일정 (`0 23 * * 0-4` UTC = 평일 08:00 KST) |

## 기술 스택

Next.js · OpenAI API · zod · nodemailer(Gmail) · Vercel Cron · Tailwind CSS

## 직접 실행하기

```bash
npm install
cp .env.example .env   # 값을 채워 넣기
npm run dev
```

필요한 환경 변수는 [.env.example](.env.example)에 있습니다. `.env`는 저장소에 올라가지 않습니다.

발송 API는 `CRON_SECRET` 토큰으로 보호됩니다.

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" "http://localhost:3000/api/briefing/send?dryRun=1"
```
