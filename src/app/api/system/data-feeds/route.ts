import { NextResponse } from "next/server";

export const maxDuration = 30;

interface ProviderStatus {
  name: string;
  status: "ok" | "error" | "no_key" | "rate_limited";
  latencyMs: number | null;
  message: string;
  provides: string;
  tier: string;
  fallback?: string;
}

async function pingProvider(
  name: string,
  testFn: () => Promise<{ ok: boolean; message: string }>,
  provides: string,
  tier: string,
  fallback?: string
): Promise<ProviderStatus> {
  const start = Date.now();
  try {
    const { ok, message } = await testFn();
    return {
      name,
      status: ok ? "ok" : "error",
      latencyMs: Date.now() - start,
      message,
      provides,
      tier,
      fallback,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isRateLimit = msg.toLowerCase().includes("rate limit") || msg.includes("429");
    return {
      name,
      status: isRateLimit ? "rate_limited" : "error",
      latencyMs: Date.now() - start,
      message: msg.slice(0, 150),
      provides,
      tier,
      fallback,
    };
  }
}

export async function GET() {
  const providers: Promise<ProviderStatus>[] = [];

  // 1. Massive (Polygon.io) — PRIMARY provider for all market data
  const massiveKey = process.env.MASSIVE_API_KEY;
  providers.push(
    massiveKey
      ? pingProvider(
          "Massive",
          async () => {
            const res = await fetch(
              `https://api.polygon.io/v2/aggs/ticker/C:EURUSD/prev?apiKey=${massiveKey}`,
              { cache: "no-store" }
            );
            if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
            const data = await res.json();
            return { ok: data.status === "OK", message: data.status === "OK" ? "Connected" : (data.error || "No data") };
          },
          "Forex, commodities, crypto candles & quotes (primary)",
          "Paid (unlimited)"
        )
      : Promise.resolve({
          name: "Massive",
          status: "no_key" as const,
          latencyMs: null,
          message: "MASSIVE_API_KEY not set",
          provides: "Forex, commodities, crypto candles & quotes (primary)",
          tier: "Paid (unlimited)",
        })
  );

  // 2. CoinGecko — crypto fallback
  providers.push(
    pingProvider(
      "CoinGecko",
      async () => {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/ping",
          { cache: "no-store" }
        );
        if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
        const data = await res.json();
        return { ok: !!data.gecko_says, message: "Connected" };
      },
      "Crypto prices (fallback)",
      "Free (25 req/min)"
    )
  );

  // 3. FRED — bond yields, economic indicators
  const fredKey = process.env.FRED_API_KEY;
  providers.push(
    fredKey
      ? pingProvider(
          "FRED",
          async () => {
            const res = await fetch(
              `https://api.stlouisfed.org/fred/series?series_id=DGS10&api_key=${fredKey}&file_type=json`,
              { cache: "no-store" }
            );
            if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
            const data = await res.json();
            return { ok: !!data.seriess, message: "Connected" };
          },
          "Bond yields, economic data",
          "Free (100 req/min)"
        )
      : Promise.resolve({
          name: "FRED",
          status: "no_key" as const,
          latencyMs: null,
          message: "FRED_API_KEY not set",
          provides: "Bond yields, economic data",
          tier: "Free (100 req/min)",
        })
  );

  // 4. FMP — economic calendar
  const fmpKey = process.env.FMP_API_KEY;
  providers.push(
    fmpKey
      ? pingProvider(
          "FMP",
          async () => {
            const today = new Date().toISOString().split("T")[0];
            const res = await fetch(
              `https://financialmodelingprep.com/api/v3/economic_calendar?from=${today}&to=${today}&apikey=${fmpKey}`,
              { cache: "no-store" }
            );
            if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
            return { ok: true, message: "Connected" };
          },
          "Economic calendar",
          "Free (250 req/day)"
        )
      : Promise.resolve({
          name: "FMP",
          status: "no_key" as const,
          latencyMs: null,
          message: "FMP_API_KEY not set",
          provides: "Economic calendar",
          tier: "Free (250 req/day)",
        })
  );

  // 5. Fear & Greed Index
  providers.push(
    pingProvider(
      "Fear & Greed",
      async () => {
        const res = await fetch(
          "https://api.alternative.me/fng/?limit=1&format=json",
          { cache: "no-store" }
        );
        if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
        const data = await res.json();
        return { ok: data.data?.length > 0, message: "Connected" };
      },
      "Crypto sentiment index",
      "Free (no key)"
    )
  );

  // 6. Anthropic — LLM analysis
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  providers.push(
    anthropicKey
      ? pingProvider(
          "Anthropic",
          async () => {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-6",
                max_tokens: 5,
                messages: [{ role: "user", content: "ok" }],
              }),
            });
            if (!res.ok) {
              const body = await res.text().catch(() => "");
              const isOverloaded = body.includes("overloaded");
              return {
                ok: false,
                message: isOverloaded ? "Overloaded" : `HTTP ${res.status}`,
              };
            }
            return { ok: true, message: "Connected" };
          },
          "Market analysis, advisor",
          "Paid (45 req/min)"
        )
      : Promise.resolve({
          name: "Anthropic",
          status: "no_key" as const,
          latencyMs: null,
          message: "ANTHROPIC_API_KEY not set",
          provides: "Market analysis, advisor",
          tier: "Paid (45 req/min)",
        })
  );

  const results = await Promise.all(providers);

  const okCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return NextResponse.json(
    {
      providers: results,
      summary: { total: results.length, ok: okCount, error: errorCount },
      timestamp: Date.now(),
    },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" } }
  );
}
