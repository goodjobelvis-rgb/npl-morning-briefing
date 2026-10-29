export type Source = "fsc" | "news";

// 수집 단계에서 모은 기사 한 건
export type RawArticle = {
  id: string;
  source: Source;
  title: string;
  url: string;
  publishedAt: string; // ISO 8601
  text: string; // 본문 또는 요약문 (AI 판단용)
};

// AI 정리를 마친 소식 한 건
export type BriefingItem = {
  title: string;
  summary: string[];
  links: string[];
  isFsc: boolean;
};

export type Briefing = {
  generatedAt: string;
  collected: { fsc: number; news: number };
  items: BriefingItem[];
};
