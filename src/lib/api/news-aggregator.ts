import type { NewsItem } from "@/lib/types/market";
import { analyzeSentiment } from "@/lib/calculations/sentiment-analyzer";

export async function fetchAggregatedNews(
  categories: string[] = ["general", "forex", "crypto"]
): Promise<NewsItem[]> {
  // TODO: Wire up a news provider (Polygon News, NewsAPI, etc.)
  void categories;
  return [];
}

export function filterNewsByInstrument(news: NewsItem[], instrumentId: string): NewsItem[] {
  const keywords: Record<string, string[]> = {
    EUR_USD: ["eur", "euro", "ecb", "eurozone", "europe", "eur/usd"],
    GBP_USD: ["gbp", "pound", "sterling", "boe", "bank of england", "gbp/usd", "uk"],
    USD_JPY: ["jpy", "yen", "boj", "bank of japan", "usd/jpy", "japan"],
    BTC_USD: ["bitcoin", "btc", "crypto", "cryptocurrency", "satoshi", "blockchain"],
    US100: ["nasdaq", "us100", "tech stocks", "technology", "big tech", "us tech"],
    US30: ["dow", "us30", "dow jones", "djia", "blue chip"],
  };

  const relevantKeywords = keywords[instrumentId] || [];
  if (relevantKeywords.length === 0) return news;

  const usdKeywords = ["usd", "dollar", "fed", "federal reserve", "fomc", "nfp", "cpi"];
  const allKeywords = [...relevantKeywords, ...usdKeywords];

  return news.filter((item) => {
    const text = (item.headline + " " + item.summary).toLowerCase();
    return allKeywords.some((kw) => text.includes(kw));
  });
}
