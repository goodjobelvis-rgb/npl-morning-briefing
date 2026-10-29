import "server-only";
import { KEYWORDS, LOOKBACK_HOURS } from "./config";
import { fetchFscPressReleases } from "./sources/fsc";
import { fetchNews } from "./sources/news";
import { summarizeArticles } from "./summarize";
import type { Briefing } from "./types";

// M1: 수집 → AI 정리. 발송(M2)은 이 결과를 받아 메일로 보낸다.
export async function buildBriefing(now = new Date()): Promise<Briefing> {
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);

  const [fsc, news] = await Promise.all([
    fetchFscPressReleases(since),
    fetchNews(KEYWORDS, since),
  ]);

  return {
    generatedAt: now.toISOString(),
    collected: { fsc: fsc.length, news: news.length },
    items: await summarizeArticles([...fsc, ...news]),
  };
}
