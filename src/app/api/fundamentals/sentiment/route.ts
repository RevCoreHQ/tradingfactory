import { NextRequest, NextResponse } from "next/server";
import { fetchAggregatedNews, filterNewsByInstrument } from "@/lib/api/news-aggregator";
import { aggregateSentiment } from "@/lib/calculations/sentiment-analyzer";

export async function GET(req: NextRequest) {
  try {
    const instrument = req.nextUrl.searchParams.get("instrument") || "";

    let news = await fetchAggregatedNews();

    if (instrument) {
      news = filterNewsByInstrument(news, instrument);
    }

    const sentiment = aggregateSentiment(news);

    return NextResponse.json(
      {
        instrument,
        newsCount: news.length,
        ...sentiment,
      },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("Sentiment error:", error);
    return NextResponse.json(
      {
        instrument: "",
        newsCount: 0,
        avgScore: 0,
        distribution: { bearish: 0, neutral: 0, bullish: 0 },
        biasScore: 50,
      },
      { status: 200 }
    );
  }
}
