interface SentimentResult {
  score: number; // -1 to +1
  magnitude: number; // 0 to 1
  label: "bearish" | "neutral" | "bullish";
}

const BULLISH_KEYWORDS: [string, number][] = [
  ["rally", 0.7],
  ["rallied", 0.7],
  ["rallies", 0.7],
  ["surge", 0.8],
  ["surged", 0.8],
  ["surging", 0.8],
  ["breakout", 0.6],
  ["bullish", 0.8],
  ["upside", 0.5],
  ["gain", 0.4],
  ["gains", 0.4],
  ["gained", 0.4],
  ["rising", 0.4],
  ["rises", 0.4],
  ["rose", 0.4],
  ["higher", 0.3],
  ["climbs", 0.5],
  ["climbed", 0.5],
  ["jumps", 0.6],
  ["jumped", 0.6],
  ["soars", 0.7],
  ["soared", 0.7],
  ["recovery", 0.5],
  ["rebound", 0.5],
  ["rebounds", 0.5],
  ["rebounded", 0.5],
  ["positive", 0.3],
  ["optimism", 0.4],
  ["optimistic", 0.5],
  ["strong growth", 0.6],
  ["beat expectations", 0.7],
  ["beats expectations", 0.7],
  ["exceeded expectations", 0.7],
  ["better than expected", 0.6],
  ["above forecast", 0.5],
  ["dovish", 0.5], // context-dependent but generally asset-bullish
  ["rate cut", 0.6],
  ["rate cuts", 0.6],
  ["stimulus", 0.5],
  ["easing", 0.4],
  ["accomodative", 0.4],
  ["buying", 0.3],
  ["buy", 0.2],
  ["upgrade", 0.5],
  ["upgraded", 0.5],
  ["outperform", 0.5],
  ["momentum", 0.3],
  ["expansion", 0.4],
  ["boom", 0.6],
  ["booming", 0.6],
  ["record high", 0.7],
  ["all-time high", 0.7],
  ["ath", 0.6],
  ["support holds", 0.4],
  ["strong support", 0.4],
];

const BEARISH_KEYWORDS: [string, number][] = [
  ["crash", 0.9],
  ["crashed", 0.9],
  ["plunge", 0.8],
  ["plunged", 0.8],
  ["plunges", 0.8],
  ["selloff", 0.7],
  ["sell-off", 0.7],
  ["selling", 0.4],
  ["bearish", 0.8],
  ["downside", 0.5],
  ["decline", 0.5],
  ["declined", 0.5],
  ["declining", 0.5],
  ["drops", 0.5],
  ["dropped", 0.5],
  ["drop", 0.4],
  ["falling", 0.5],
  ["falls", 0.5],
  ["fell", 0.5],
  ["lower", 0.3],
  ["slumps", 0.6],
  ["slumped", 0.6],
  ["tumbles", 0.6],
  ["tumbled", 0.6],
  ["sinks", 0.6],
  ["negative", 0.3],
  ["pessimism", 0.4],
  ["pessimistic", 0.5],
  ["weak growth", 0.5],
  ["missed expectations", 0.6],
  ["misses expectations", 0.6],
  ["below expectations", 0.6],
  ["worse than expected", 0.6],
  ["below forecast", 0.5],
  ["hawkish", 0.4], // context-dependent
  ["rate hike", 0.5],
  ["rate hikes", 0.5],
  ["tightening", 0.4],
  ["recession", 0.7],
  ["recessionary", 0.7],
  ["contraction", 0.6],
  ["slowdown", 0.5],
  ["default", 0.7],
  ["crisis", 0.6],
  ["panic", 0.7],
  ["fear", 0.4],
  ["downgrade", 0.5],
  ["downgraded", 0.5],
  ["underperform", 0.5],
  ["correction", 0.5],
  ["bear market", 0.7],
  ["inflation soars", 0.6],
  ["record low", 0.6],
  ["bankruptcy", 0.8],
  ["collapse", 0.8],
  ["collapsed", 0.8],
  ["resistance holds", 0.3],
  ["strong resistance", 0.3],
  ["warning", 0.4],
  ["warns", 0.4],
  ["layoffs", 0.5],
  ["unemployment rises", 0.6],
];

export function analyzeSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase();
  let bullishScore = 0;
  let bearishScore = 0;
  let matchCount = 0;

  for (const [keyword, weight] of BULLISH_KEYWORDS) {
    if (lower.includes(keyword)) {
      bullishScore += weight;
      matchCount++;
    }
  }

  for (const [keyword, weight] of BEARISH_KEYWORDS) {
    if (lower.includes(keyword)) {
      bearishScore += weight;
      matchCount++;
    }
  }

  // Check for negation patterns
  const negationPatterns = ["not ", "no ", "don't ", "doesn't ", "didn't ", "won't ", "isn't "];
  for (const neg of negationPatterns) {
    if (lower.includes(neg)) {
      // Swap a portion of scores
      const temp = bullishScore * 0.3;
      bullishScore -= temp;
      bearishScore += temp;
    }
  }

  if (matchCount === 0) {
    return { score: 0, magnitude: 0, label: "neutral" };
  }

  const rawScore = (bullishScore - bearishScore) / (bullishScore + bearishScore || 1);
  const score = Math.max(-1, Math.min(1, rawScore));
  const magnitude = Math.min(1, (bullishScore + bearishScore) / 5);

  let label: "bearish" | "neutral" | "bullish";
  if (score > 0.15) label = "bullish";
  else if (score < -0.15) label = "bearish";
  else label = "neutral";

  return { score, magnitude, label };
}

export function aggregateSentiment(
  items: { sentimentScore: number; sentimentLabel: string }[]
): {
  avgScore: number;
  distribution: { bearish: number; neutral: number; bullish: number };
  biasScore: number; // 0-100
} {
  if (items.length === 0) {
    return {
      avgScore: 0,
      distribution: { bearish: 0, neutral: 0, bullish: 0 },
      biasScore: 50,
    };
  }

  const total = items.length;
  const distribution = {
    bearish: items.filter((i) => i.sentimentLabel === "bearish").length / total,
    neutral: items.filter((i) => i.sentimentLabel === "neutral").length / total,
    bullish: items.filter((i) => i.sentimentLabel === "bullish").length / total,
  };

  // Weighted average: more recent news weighted higher
  let weightedSum = 0;
  let weightTotal = 0;
  items.forEach((item, index) => {
    const weight = 1 + (items.length - index) / items.length; // newer = higher weight
    weightedSum += item.sentimentScore * weight;
    weightTotal += weight;
  });

  const avgScore = weightedSum / weightTotal;
  const biasScore = (avgScore + 1) * 50; // Map -1..+1 to 0..100

  return { avgScore, distribution, biasScore };
}
