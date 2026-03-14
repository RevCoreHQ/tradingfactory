import { checkRateLimit } from "./rate-limiter";
import type { BondYield, EconomicIndicators, DXYData } from "@/lib/types/market";
import { FRED_SERIES } from "@/lib/utils/constants";

const BASE_URL = "https://api.stlouisfed.org/fred";

function getApiKey(): string {
  return process.env.FRED_API_KEY || "";
}

async function fredFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const { allowed } = checkRateLimit("fred");
  if (!allowed) throw new Error("FRED rate limit exceeded");

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("file_type", "json");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`FRED error: ${res.status}`);
  return res.json();
}

export async function fetchSeriesObservations(
  seriesId: string,
  options: { limit?: number; startDate?: string } = {}
): Promise<{ date: string; value: number }[]> {
  const params: Record<string, string> = {
    series_id: seriesId,
    sort_order: "desc",
    limit: String(options.limit || 30),
  };
  if (options.startDate) params.observation_start = options.startDate;

  const data = await fredFetch<{
    observations: Array<{ date: string; value: string }>;
  }>("/series/observations", params);

  return (data.observations || [])
    .filter((o) => o.value !== ".")
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();
}

export async function fetchBondYields(): Promise<BondYield[]> {
  const series = [
    { id: FRED_SERIES.TREASURY_2Y, maturity: "2Y" },
    { id: FRED_SERIES.TREASURY_10Y, maturity: "10Y" },
    { id: FRED_SERIES.TREASURY_30Y, maturity: "30Y" },
  ];

  const results = await Promise.all(
    series.map(async (s) => {
      const obs = await fetchSeriesObservations(s.id, { limit: 5 });
      if (obs.length < 2) return null;
      const current = obs[obs.length - 1].value;
      const previous = obs[obs.length - 2].value;
      return {
        maturity: s.maturity,
        yield: current,
        change: current - previous,
        seriesId: s.id,
      } as BondYield;
    })
  );

  return results.filter((r): r is BondYield => r !== null);
}

export async function fetchDXY(): Promise<DXYData> {
  const obs = await fetchSeriesObservations(FRED_SERIES.DXY, { limit: 30 });
  if (obs.length < 2) {
    return { value: 0, change: 0, changePercent: 0, history: [] };
  }
  const current = obs[obs.length - 1].value;
  const previous = obs[obs.length - 2].value;
  const change = current - previous;
  const changePercent = (change / previous) * 100;

  return {
    value: current,
    change,
    changePercent,
    history: obs,
  };
}

export async function fetchFedFundsRate(): Promise<{
  current: number;
  previous: number;
  target: number;
}> {
  const [rateObs, targetObs] = await Promise.all([
    fetchSeriesObservations(FRED_SERIES.FED_FUNDS_RATE, { limit: 5 }),
    fetchSeriesObservations(FRED_SERIES.FED_FUNDS_TARGET_UPPER, { limit: 5 }),
  ]);

  const current = rateObs.length > 0 ? rateObs[rateObs.length - 1].value : 0;
  const previous = rateObs.length > 1 ? rateObs[rateObs.length - 2].value : current;
  const target = targetObs.length > 0 ? targetObs[targetObs.length - 1].value : current;

  return { current, previous, target };
}

export async function fetchEconomicIndicators(): Promise<EconomicIndicators> {
  const [cpiObs, gdpObs, unrateObs, fedRate] = await Promise.all([
    fetchSeriesObservations(FRED_SERIES.CPI, { limit: 2 }),
    fetchSeriesObservations(FRED_SERIES.GDP, { limit: 2 }),
    fetchSeriesObservations(FRED_SERIES.UNEMPLOYMENT, { limit: 2 }),
    fetchFedFundsRate(),
  ]);

  return {
    cpi: cpiObs.length > 0 ? cpiObs[cpiObs.length - 1].value : 0,
    gdp: gdpObs.length > 0 ? gdpObs[gdpObs.length - 1].value : 0,
    unemployment: unrateObs.length > 0 ? unrateObs[unrateObs.length - 1].value : 0,
    fedFundsRate: fedRate.current,
    fedFundsTarget: fedRate.target,
  };
}
