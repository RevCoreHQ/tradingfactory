import type { NewsItem } from "@/lib/types/market";

const BASE_URL = "https://api.polygon.io";

function getApiKey(): string {
  return process.env.MASSIVE_API_KEY || "";
}

function scoreSentiment(text: string): { score: number; label: "bearish" | "neutral" | "bullish" } {
  const lower = text.toLowerCase();
  const bullish = ["surge", "rally", "gain", "jump", "rise", "soar", "boom", "bull", "optimis", "record high", "upgrade", "beat"];
  const bearish = ["crash", "plunge", "drop", "fall", "slump", "sink", "bear", "pessimis", "fear", "recession", "downgrade", "miss", "concern", "risk", "warn"];

  let score = 0;
  for (const w of bullish) if (lower.includes(w)) score += 1;
  for (const w of bearish) if (lower.includes(w)) score -= 1;

  if (score >= 1) return { score: Math.min(score * 0.3, 1), label: "bullish" };
  if (score <= -1) return { score: Math.max(score * 0.3, -1), label: "bearish" };
  return { score: 0, label: "neutral" };
}

export async function fetchAggregatedNews(
  categories: string[] = ["general", "forex", "crypto"]
): Promise<NewsItem[]> {
  const key = getApiKey();
  if (!key) return [];

  try {
    const url = `${BASE_URL}/v2/reference/news?limit=20&order=desc&sort=published_utc&apiKey=${key}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];

    const data = await res.json();
    const results: unknown[] = data.results || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return results.map((item: any, i: number) => {
      const headline = (item.title as string) || "";
      const summary = (item.description as string) || "";
      const sentiment = scoreSentiment(headline + " " + summary);

      const tickers = (item.tickers as string[]) || [];
      const related: string[] = [];
      for (const t of tickers) {
        if (t.includes("EUR") || t.includes("USD")) related.push("EUR_USD");
        if (t.includes("GBP")) related.push("GBP_USD");
        if (t.includes("JPY")) related.push("USD_JPY");
        if (t.includes("BTC") || t.includes("bitcoin")) related.push("BTC_USD");
        if (t.includes("ETH")) related.push("ETH_USD");
        if (t.includes("GOLD") || t.includes("XAU")) related.push("XAU_USD");
        if (t.includes("OIL") || t.includes("CL")) related.push("USOIL");
        if (t.includes("NDX") || t.includes("NASDAQ")) related.push("US100");
        if (t.includes("DJI") || t.includes("DOW")) related.push("US30");
      }

      return {
        id: (item.id as string) || `polygon-${i}`,
        headline,
        summary,
        source: (item.publisher as Record<string, string>)?.name || "Polygon",
        url: (item.article_url as string) || "",
        publishedAt: (item.published_utc as string) || new Date().toISOString(),
        category: categories[0] || "general",
        relatedInstruments: [...new Set(related)],
        sentimentScore: sentiment.score,
        sentimentLabel: sentiment.label,
      };
    });
  } catch (err) {
    console.error("Polygon news fetch error:", err);
    return [];
  }
}

export function filterNewsByInstrument(news: NewsItem[], instrumentId: string): NewsItem[] {
  const keywords: Record<string, string[]> = {
    EUR_USD: ["eur", "euro", "ecb", "eurozone", "europe", "eur/usd"],
    GBP_USD: ["gbp", "pound", "sterling", "boe", "bank of england", "gbp/usd", "uk"],
    USD_JPY: ["jpy", "yen", "boj", "bank of japan", "usd/jpy", "japan"],
    USD_CAD: ["cad", "canadian", "boc", "bank of canada", "usd/cad", "canada"],
    USD_CHF: ["chf", "swiss", "snb", "switzerland", "franc", "usd/chf"],
    AUD_USD: ["aud", "australian", "rba", "australia", "aud/usd"],
    NZD_USD: ["nzd", "new zealand", "rbnz", "kiwi", "nzd/usd"],
    BTC_USD: ["bitcoin", "btc", "crypto", "cryptocurrency", "satoshi", "blockchain"],
    ETH_USD: ["ethereum", "eth", "defi", "smart contract"],
    XAU_USD: ["gold", "xau", "precious metal", "bullion", "safe haven"],
    XAG_USD: ["silver", "xag", "precious metal"],
    USOIL: ["oil", "crude", "wti", "brent", "opec", "petroleum", "energy"],
    US100: ["nasdaq", "us100", "tech stocks", "technology", "big tech", "us tech"],
    US30: ["dow", "us30", "dow jones", "djia", "blue chip"],
  };

  const relevantKeywords = keywords[instrumentId] || [];
  if (relevantKeywords.length === 0) return news;

  const usdKeywords = ["usd", "dollar", "fed", "federal reserve", "fomc", "nfp", "cpi"];
  const allKeywords = [...relevantKeywords, ...usdKeywords];

  return news.filter((item) => {
    if (item.relatedInstruments.includes(instrumentId)) return true;
    const text = (item.headline + " " + item.summary).toLowerCase();
    return allKeywords.some((kw) => text.includes(kw));
  });
}
