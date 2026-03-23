import { NextRequest, NextResponse } from "next/server";
import { fetchForexRates, fetchForexCandleData } from "@/lib/api/finnhub";
import { fetchCryptoPrice } from "@/lib/api/coingecko";
import { fetchTwelveDataBatchPrices } from "@/lib/api/twelve-data";
import { INSTRUMENTS } from "@/lib/utils/constants";
import type { PriceQuote } from "@/lib/types/market";

export async function GET(req: NextRequest) {
  try {
    const requestedIds = req.nextUrl.searchParams.get("instruments")?.split(",") || INSTRUMENTS.map((i) => i.id);

    const quotes: Record<string, PriceQuote> = {};

    // ── Batch fetch all Twelve Data prices in ONE API call ──
    // Forex + commodity + index instruments all go through Twelve Data
    const tdInstruments = INSTRUMENTS.filter(
      (i) => (i.category === "forex" || i.category === "commodity" || i.category === "index") && requestedIds.includes(i.id)
    );

    const tdSymbolMap: Record<string, typeof tdInstruments[0]> = {};
    for (const inst of tdInstruments) {
      const sym = inst.twelveDataSymbol || inst.symbol;
      tdSymbolMap[sym] = inst;
    }

    const tdSymbols = Object.keys(tdSymbolMap);
    let batchPrices: Record<string, number> = {};

    if (tdSymbols.length > 0) {
      try {
        batchPrices = await fetchTwelveDataBatchPrices(tdSymbols);
      } catch {
        // Batch fetch failed — will fall through to Finnhub
      }
    }

    // Apply batch results to quotes
    for (const [sym, price] of Object.entries(batchPrices)) {
      const inst = tdSymbolMap[sym];
      if (inst && price > 0) {
        quotes[inst.id] = {
          instrument: inst.id,
          bid: price - inst.pipSize,
          ask: price + inst.pipSize,
          mid: price,
          timestamp: Date.now(),
          change: 0,
          changePercent: 0,
          high24h: price,
          low24h: price,
        };
      }
    }

    // ── Fallback: Finnhub for missing forex ──
    const forexMissing = INSTRUMENTS.filter(
      (i) => i.category === "forex" && requestedIds.includes(i.id) && !quotes[i.id]
    );
    if (forexMissing.length > 0) {
      try {
        const finnhubRates = await fetchForexRates("USD");
        for (const inst of forexMissing) {
          const from = inst.alphavantageSymbol;
          const to = inst.alphavantageToSymbol || "USD";
          let mid = 0;
          if (from === "USD") {
            mid = finnhubRates[to] || 0;
          } else if (to === "USD") {
            mid = finnhubRates[from] ? 1 / finnhubRates[from] : 0;
          } else {
            mid = finnhubRates[from] && finnhubRates[to] ? finnhubRates[to] / finnhubRates[from] : 0;
          }
          if (mid > 0) {
            quotes[inst.id] = {
              instrument: inst.id,
              bid: mid - inst.pipSize,
              ask: mid + inst.pipSize,
              mid,
              timestamp: Date.now(),
              change: 0,
              changePercent: 0,
              high24h: mid,
              low24h: mid,
            };
          }
        }
      } catch (err) {
        console.warn("[Rates] Finnhub forex fallback failed:", err);
      }
    }

    // ── Fallback: Finnhub candles for missing commodity/index ──
    const candleMissing = INSTRUMENTS.filter(
      (i) => (i.category === "commodity" || i.category === "index") && requestedIds.includes(i.id) && !quotes[i.id]
    );
    for (const inst of candleMissing) {
      try {
        const now = Math.floor(Date.now() / 1000);
        const fromTs = now - 24 * 60 * 60;
        const candles = await fetchForexCandleData(inst.finnhubSymbol || "", "60", fromTs, now);
        if (candles.length > 0) {
          const latest = candles[candles.length - 1];
          const first = candles[0];
          const change = latest.close - first.open;
          const changePercent = (change / first.open) * 100;
          quotes[inst.id] = {
            instrument: inst.id,
            bid: latest.close - inst.pipSize,
            ask: latest.close + inst.pipSize,
            mid: latest.close,
            timestamp: latest.timestamp,
            change,
            changePercent,
            high24h: Math.max(...candles.map((c) => c.high)),
            low24h: Math.min(...candles.map((c) => c.low)),
          };
        }
      } catch {
        // Finnhub candle fallback failed
      }
    }

    // ── Crypto prices (CoinGecko, not Twelve Data) ──
    const cryptoInstruments = INSTRUMENTS.filter(
      (i) => i.category === "crypto" && requestedIds.includes(i.id)
    );
    for (const inst of cryptoInstruments) {
      try {
        quotes[inst.id] = await fetchCryptoPrice(inst.coingeckoId || "bitcoin", inst.id);
      } catch {
        // Silent fail
      }
    }

    return NextResponse.json(
      { quotes },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=10" } }
    );
  } catch (error) {
    console.error("Rates API error:", error);
    return NextResponse.json({ quotes: {} }, { status: 200 });
  }
}
