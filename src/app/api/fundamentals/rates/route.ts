import { NextRequest, NextResponse } from "next/server";
import { fetchForexRates, fetchForexCandleData, fetchCandles } from "@/lib/api/finnhub";
import { fetchCryptoPrice } from "@/lib/api/coingecko";
import { fetchTwelveDataBatchQuotes, fetchTwelveDataCandles } from "@/lib/api/twelve-data";
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

    if (tdSymbols.length > 0) {
      try {
        const batchQuotes = await fetchTwelveDataBatchQuotes(tdSymbols);
        for (const [sym, q] of Object.entries(batchQuotes)) {
          const inst = tdSymbolMap[sym];
          if (inst && q.price > 0) {
            quotes[inst.id] = {
              instrument: inst.id,
              bid: q.price - inst.pipSize,
              ask: q.price + inst.pipSize,
              mid: q.price,
              timestamp: Date.now(),
              change: q.change,
              changePercent: q.changePercent,
              high24h: q.high24h,
              low24h: q.low24h,
            };
          }
        }
      } catch {
        // Batch fetch failed — will fall through to Finnhub
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

    // ── Fallback: Twelve Data candles for missing commodity/index ──
    const candleMissing = INSTRUMENTS.filter(
      (i) => (i.category === "commodity" || i.category === "index") && requestedIds.includes(i.id) && !quotes[i.id]
    );
    for (const inst of candleMissing) {
      const tdSym = inst.twelveDataSymbol || inst.symbol;
      try {
        // Try Twelve Data candles first (more reliable for CFD indices)
        const candles = await fetchTwelveDataCandles(tdSym, "1h", 24);
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
          continue;
        }
      } catch {
        // Twelve Data candles failed — try Finnhub
      }

      // Finnhub fallback: try /forex/candle for OANDA symbols, /stock/candle for FOREXCOM
      try {
        const now = Math.floor(Date.now() / 1000);
        const fromTs = now - 24 * 60 * 60;
        const fhSymbol = inst.finnhubSymbol || "";
        const candles = fhSymbol.startsWith("OANDA:")
          ? await fetchForexCandleData(fhSymbol, "60", fromTs, now)
          : await fetchCandles(fhSymbol, "60", fromTs, now);
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
        // Both fallbacks failed for this instrument
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
