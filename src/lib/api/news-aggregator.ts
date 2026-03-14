import { fetchMarketNews } from "./finnhub";
import type { NewsItem } from "@/lib/types/market";
import { analyzeSentiment } from "@/lib/calculations/sentiment-analyzer";

export async function fetchAggregatedNews(
  categories: string[] = ["general", "forex", "crypto"]
): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    categories.map((cat) => fetchMarketNews(cat))
  );

  let allNews: NewsItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allNews = allNews.concat(result.value);
    }
  }

  // Deduplicate by headline similarity
  allNews = deduplicateNews(allNews);

  // Enrich with sentiment
  allNews = allNews.map((item) => {
    const sentiment = analyzeSentiment(item.headline + " " + item.summary);
    return {
      ...item,
      sentimentScore: sentiment.score,
      sentimentLabel: sentiment.label,
    };
  });

  // Sort by date
  allNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return allNews.slice(0, 100);
}

function deduplicateNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.headline.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
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

  // USD-related keywords apply to all forex + index instruments
  const usdKeywords = ["usd", "dollar", "fed", "federal reserve", "fomc", "nfp", "cpi"];
  const allKeywords = [...relevantKeywords, ...usdKeywords];

  return news.filter((item) => {
    const text = (item.headline + " " + item.summary).toLowerCase();
    return allKeywords.some((kw) => text.includes(kw));
  });
}
