import { NextRequest, NextResponse } from "next/server";
import { fetchAggregatedNews, filterNewsByInstrument } from "@/lib/api/news-aggregator";
import { aggregateSentiment } from "@/lib/calculations/sentiment-analyzer";

export async function GET(req: NextRequest) {
  try {
    const instrument = req.nextUrl.searchParams.get("instrument");
    const categories = req.nextUrl.searchParams.get("categories")?.split(",") || ["general", "forex", "crypto"];

    let news = await fetchAggregatedNews(categories);

    if (instrument) {
      news = filterNewsByInstrument(news, instrument);
    }

    const sentiment = aggregateSentiment(news);

    return NextResponse.json(
      { items: news, aggregateSentiment: sentiment },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("News API error:", error);
    return NextResponse.json(
      { items: [], aggregateSentiment: { avgScore: 0, distribution: { bearish: 0, neutral: 0, bullish: 0 }, biasScore: 50 } },
      { status: 200 }
    );
  }
}
