import type { FearGreedData } from "@/lib/types/market";

const BASE_URL = "https://api.alternative.me/fng";

function getLabel(value: number): string {
  if (value <= 20) return "Extreme Fear";
  if (value <= 40) return "Fear";
  if (value <= 60) return "Neutral";
  if (value <= 80) return "Greed";
  return "Extreme Greed";
}

export async function fetchFearGreedIndex(): Promise<FearGreedData> {
  const res = await fetch(`${BASE_URL}/?limit=31&format=json`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Fear & Greed API error: ${res.status}`);

  const data = await res.json();
  const entries = data.data || [];

  const current = entries[0];
  const previousClose = entries[1];
  const previousWeek = entries[7];
  const previousMonth = entries[30];

  const value = parseInt(current?.value || "50");

  return {
    value,
    label: getLabel(value),
    timestamp: parseInt(current?.timestamp || "0") * 1000,
    previousClose: parseInt(previousClose?.value || "50"),
    previousWeek: parseInt(previousWeek?.value || "50"),
    previousMonth: parseInt(previousMonth?.value || "50"),
  };
}

export async function fetchFearGreedHistory(days: number = 30): Promise<FearGreedData[]> {
  const res = await fetch(`${BASE_URL}/?limit=${days}&format=json`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Fear & Greed API error: ${res.status}`);

  const data = await res.json();
  return (data.data || []).map((entry: { value: string; timestamp: string }) => {
    const value = parseInt(entry.value);
    return {
      value,
      label: getLabel(value),
      timestamp: parseInt(entry.timestamp) * 1000,
      previousClose: 0,
      previousWeek: 0,
      previousMonth: 0,
    };
  }).reverse();
}
