import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { MAX_ITEMS, MAX_LINKS_PER_ITEM, MAX_SUMMARY_LINES } from "./config";
import type { BriefingItem, RawArticle } from "./types";

// 다른 모델을 쓰고 싶으면 .env에 OPENAI_MODEL을 넣는다.
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

// PRD 5) M1 "AI가 지킬 규칙"을 그대로 옮긴 지시문
const SYSTEM_PROMPT = `너는 NPL(부실채권) 시장 동향 브리핑 편집자다. 입력으로 받은 기사 목록만 보고 아래 규칙을 지켜 정리한다.

1. NPL·부실채권·신용채권과 직접 관련된 기사만 남긴다. 키워드가 본문에 한 번만 스치듯 나오는 기사(예: 일반 증시 시황, 무관한 기업 소식)는 뺀다.
2. 같은 사건을 다룬 기사는 1건으로 묶고, 그 기사들의 id를 articleIds에 넣는다.
3. 요약은 ${MAX_SUMMARY_LINES}줄 이내, 한 줄에 한 문장으로 쓴다. 기사에 없는 숫자·전망·의견은 절대 덧붙이지 않는다.
4. title은 소식을 한눈에 알 수 있는 한국어 제목으로 쓴다.
5. 중요도가 높은 순서로 최대 ${MAX_ITEMS}건만 고른다. 정책 발표, 대규모 매각·인수, 시장 규모 변화가 일반 기업 소식보다 중요하다.
6. 관련 기사가 없으면 items를 빈 배열로 둔다.`;

const BriefingSchema = z.object({
  items: z.array(
    z.object({
      articleIds: z.array(z.string()),
      title: z.string(),
      summary: z.array(z.string()),
    }),
  ),
});

const client = new OpenAI();

export async function summarizeArticles(articles: RawArticle[]): Promise<BriefingItem[]> {
  if (articles.length === 0) return [];

  const input = articles.map(({ id, source, title, publishedAt, text }) => ({
    id,
    source: source === "fsc" ? "금융위원회 보도자료" : "뉴스",
    title,
    publishedAt,
    text,
  }));

  const response = await client.responses.parse({
    model: MODEL,
    instructions: SYSTEM_PROMPT,
    input: JSON.stringify(input),
    text: { format: zodTextFormat(BriefingSchema, "briefing") },
  });

  if (!response.output_parsed) {
    throw new Error(`AI 응답을 읽지 못했습니다 (status: ${response.status})`);
  }

  // 규칙 중 숫자로 확인할 수 있는 것은 코드에서 한 번 더 지킨다.
  const byId = new Map(articles.map((article) => [article.id, article]));
  const items = response.output_parsed.items
    .map((item) => {
      const sources = item.articleIds.flatMap((id) => byId.get(id) ?? []);
      return {
        title: item.title,
        summary: item.summary.slice(0, MAX_SUMMARY_LINES),
        links: [...new Set(sources.map((article) => article.url))].slice(0, MAX_LINKS_PER_ITEM),
        isFsc: sources.some((article) => article.source === "fsc"),
      };
    })
    .filter((item) => item.links.length > 0);

  // 금융위원회 보도자료는 항상 맨 위 (같은 그룹 안에서는 AI가 정한 중요도 순서 유지)
  return [...items.filter((item) => item.isFsc), ...items.filter((item) => !item.isFsc)].slice(
    0,
    MAX_ITEMS,
  );
}
