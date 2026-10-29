import "server-only";
import { decodeEntities, stripTags } from "../text";
import { MAX_ARTICLES_FOR_AI } from "../config";
import type { RawArticle } from "../types";

// 키가 필요 없는 공개 RSS 두 곳에서 키워드별 뉴스를 모은다.
// - 구글 뉴스: 기사 수가 많지만 제목만 준다. (최근 24시간 필터 지원)
// - 빙 뉴스: 기사 수는 적지만 본문 요약문(description)을 준다.
const googleUrl = (keyword: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`${keyword} when:1d`)}&hl=ko&gl=KR&ceid=KR:ko`;
const bingUrl = (keyword: string) =>
  `https://www.bing.com/news/search?q=${encodeURIComponent(keyword)}&format=rss&setlang=ko&cc=KR`;

type RssItem = { title: string; link: string; description: string; pubDate: string };

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  if (!match) return "";
  return match[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
}

function parseRss(xml: string): RssItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, block]) => ({
    title: stripTags(tag(block, "title")),
    link: decodeEntities(tag(block, "link")),
    description: tag(block, "description"),
    pubDate: tag(block, "pubDate"),
  }));
}

// 빙 링크는 apiclick.aspx?...&url=<실제 주소> 형태라서 실제 기사 주소를 꺼낸다.
function bingRealUrl(link: string): string {
  try {
    return new URL(link).searchParams.get("url") ?? link;
  } catch {
    return link;
  }
}

async function fetchFeed(url: string): Promise<RssItem[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`뉴스 RSS 요청 실패: ${res.status} (${new URL(url).hostname})`);
  return parseRss(await res.text());
}

export async function fetchNews(keywords: string[], since: Date): Promise<RawArticle[]> {
  const feeds = keywords.flatMap((keyword) => [
    fetchFeed(googleUrl(keyword)).then((items) => items.map((item) => ({ item, bing: false }))),
    fetchFeed(bingUrl(keyword)).then((items) => items.map((item) => ({ item, bing: true }))),
  ]);
  // 한 곳이 막혀도 나머지로 계속 진행한다.
  const settled = await Promise.allSettled(feeds);
  const entries = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  if (entries.length === 0) {
    const failure = settled.find((result) => result.status === "rejected");
    throw new Error(failure?.status === "rejected" ? String(failure.reason) : "뉴스 RSS가 비어 있습니다.");
  }

  // 같은 기사는 제목 기준으로 하나만 남기되, 빙의 요약문이 있으면 그쪽을 우선한다.
  const byTitle = new Map<string, RawArticle>();
  for (const { item, bing } of entries) {
    const publishedAt = new Date(item.pubDate);
    if (Number.isNaN(publishedAt.getTime()) || publishedAt < since) continue;

    const key = item.title.replace(/\s+-\s+[^-]+$/, "").replace(/\s+/g, "");
    const existing = byTitle.get(key);
    if (existing && !bing) continue;

    byTitle.set(key, {
      id: "",
      source: "news",
      title: item.title,
      url: bing ? bingRealUrl(item.link) : item.link,
      publishedAt: publishedAt.toISOString(),
      text: bing ? stripTags(item.description) : item.title,
    });
  }

  return [...byTitle.values()]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_ARTICLES_FOR_AI)
    .map((article, index) => ({ ...article, id: `news-${index + 1}` }));
}
