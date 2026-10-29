import "server-only";
import { stripTags, decodeEntities } from "../text";
import type { RawArticle } from "../types";

const BASE_URL = "https://www.fsc.go.kr";
const LIST_URL = `${BASE_URL}/no010101`;
const MAX_BODY_CHARS = 4000;

type ListEntry = { id: string; title: string; date: string };

// 보도자료 목록 페이지의 <li> 하나에서 글 번호, 제목, 날짜(YYYY-MM-DD)를 뽑는다.
function parseList(html: string): ListEntry[] {
  const entries: ListEntry[] = [];
  const itemPattern =
    /<a href="\/no010101\/(\d+)[^"]*"\s+title="([^"]*)"[\s\S]*?<div class="day">(\d{4}-\d{2}-\d{2})<\/div>/g;
  for (const match of html.matchAll(itemPattern)) {
    entries.push({ id: match[1], title: decodeEntities(match[2]).trim(), date: match[3] });
  }
  return entries;
}

// 상세 페이지에서 본문(.board-view-wrap 안의 body 영역)만 텍스트로 꺼낸다.
function parseBody(html: string): string {
  const start = html.indexOf('class="body"');
  const end = html.indexOf('class="foot"', start);
  if (start === -1) return "";
  const section = html.slice(start, end === -1 ? undefined : end);
  return stripTags(section.slice(section.indexOf(">") + 1)).slice(0, MAX_BODY_CHARS);
}

// 날짜만 있는 게시판이라, since 시각이 속한 한국 날짜 이후의 글을 모두 가져온다.
function kstDate(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function fetchFscPressReleases(since: Date): Promise<RawArticle[]> {
  const res = await fetch(LIST_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`금융위원회 보도자료 목록 요청 실패: ${res.status}`);

  const sinceDate = kstDate(since);
  const recent = parseList(await res.text()).filter((entry) => entry.date >= sinceDate);

  return Promise.all(
    recent.map(async (entry) => {
      const url = `${LIST_URL}/${entry.id}`;
      const detail = await fetch(url, { cache: "no-store" });
      const text = detail.ok ? parseBody(await detail.text()) : "";
      return {
        id: `fsc-${entry.id}`,
        source: "fsc" as const,
        title: entry.title,
        url,
        publishedAt: `${entry.date}T00:00:00+09:00`,
        text: text || entry.title,
      };
    }),
  );
}
