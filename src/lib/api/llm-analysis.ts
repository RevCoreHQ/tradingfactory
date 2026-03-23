import type {
  LLMProvider,
  LLMSignal,
  LLMAnalysisResult,
  LLMBatchResult,
  LLMAnalysisRequest,
  LLMBatchRequest,
  MarketSummaryRequest,
  MarketSummaryResult,
} from "@/lib/types/llm";
import { checkRateLimit } from "./rate-limiter";

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

function getAvailableProviders(): { provider: LLMProvider; key: string }[] {
  const providers: { provider: LLMProvider; key: string }[] = [];
  // Anthropic first — primary provider
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({ provider: "anthropic", key: process.env.ANTHROPIC_API_KEY });
  }
  // Gemini as backup
  if (process.env.GEMINI_API_KEY) {
    providers.push({ provider: "gemini", key: process.env.GEMINI_API_KEY });
  }
  // OpenAI as final fallback
  if (process.env.OPENAI_API_KEY) {
    providers.push({ provider: "openai", key: process.env.OPENAI_API_KEY });
  }
  return providers;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SINGLE_SYSTEM_PROMPT = `You are an elite quantitative market analyst at a prop trading desk. Your role is to provide narrative context and risk assessment for financial instruments. You do NOT adjust scores or influence the mechanical scoring system.

Rules:
- Provide 2-5 signals, each with a source name, signal direction (bullish/bearish/neutral), strength (0-100), and a brief description explaining your reasoning.
- Include a confidence score (0-100) indicating how confident you are in the overall assessment.
- Include a short summary sentence (one sentence max) describing the current market context for this instrument.
- Include fundamentalReason: 1-2 sentences explaining what is driving the fundamental picture — reference specific macro factors (central bank stance, news sentiment, DXY correlation, Fear & Greed, bond yields).
- Include technicalReason: 1-2 sentences explaining what is driving the technical picture — reference specific indicators (RSI, MACD, trend strength, Bollinger %B, support/resistance).
- Include keyLevels: the most important support and resistance price levels you identify.
- Include projectedMovePercent: your estimate of likely % move in the dominant direction (0.1 to 5.0).
- Include riskAssessment: "low", "medium", or "high" — how risky are current conditions?
- Include catalysts: 1-3 upcoming events or factors that could trigger a move.
- Respond with valid JSON only. Do not include any markdown formatting or explanation outside the JSON.`;

const BATCH_SYSTEM_PROMPT = `You are an elite quantitative market analyst. Provide narrative context and risk assessment for multiple instruments. Be concise — keep each instrument's analysis compact. You do NOT adjust scores or influence the mechanical scoring system.

Rules per instrument:
- confidence: 0-100
- signals: exactly 2 signals per instrument (keep descriptions under 15 words)
- summary: one short sentence describing current market context
- fundamentalReason: one sentence on what drives the fundamental picture
- technicalReason: one sentence on what drives the technical picture
- keyLevels: { support, resistance } — key price levels
- projectedMovePercent: 0.1-5.0
- riskAssessment: "low" | "medium" | "high"
- catalysts: 1-2 short items
- Respond with valid JSON only.`;

// ---------------------------------------------------------------------------
// Prompt construction — single instrument
// ---------------------------------------------------------------------------

function buildSinglePrompt(req: LLMAnalysisRequest): string {
  const yieldCurveSpread =
    req.bondYields.length >= 2
      ? (() => {
          const sorted = [...req.bondYields].sort(
            (a, b) => parseFloat(a.maturity) - parseFloat(b.maturity)
          );
          const short = sorted[0];
          const long = sorted[sorted.length - 1];
          return (long.yield - short.yield).toFixed(3);
        })()
      : "N/A";

  let prompt = `Analyze the following instrument and provide your bias adjustment.

Instrument: ${req.instrument}
Category: ${req.category}
Current Price: ${req.currentPrice}
24h Price Change: ${req.priceChange24h >= 0 ? "+" : ""}${req.priceChange24h.toFixed(2)}%

--- Macro Context ---
Fear & Greed Index: ${req.fearGreed.value} (${req.fearGreed.label})
DXY (US Dollar Index): ${req.dxy.value} (Change: ${req.dxy.change >= 0 ? "+" : ""}${req.dxy.change.toFixed(2)})

Bond Yields:
${req.bondYields.map((b) => `  ${b.maturity}: ${b.yield.toFixed(3)}% (${b.change >= 0 ? "+" : ""}${b.change.toFixed(3)})`).join("\n")}
Yield Curve Spread (long - short): ${yieldCurveSpread}

Central Bank Stances:
${req.centralBanks.map((cb) => `  ${cb.bank}: Rate ${cb.rate}%, Direction: ${cb.direction}, Stance: ${cb.stance}`).join("\n")}

Top News Headlines:
${req.newsHeadlines.map((n) => `  - [${n.sentiment}, score: ${n.score}] ${n.headline}`).join("\n")}
`;

  if (req.technicals) {
    prompt += `
--- Technical Indicators ---
RSI: ${req.technicals.rsi.toFixed(1)} (${req.technicals.rsiSignal})
MACD Histogram: ${req.technicals.macdHistogram.toFixed(4)}
MACD Crossover: ${req.technicals.macdCrossover ?? "None"}
Trend: ${req.technicals.trend} (Strength: ${req.technicals.trendStrength.toFixed(1)})
Bollinger %B: ${req.technicals.bbPercentB.toFixed(3)}
`;
  }

  prompt += `
--- Rule-Based Scores ---
Fundamental Score: ${req.ruleBasedScores.fundamentalTotal}
Technical Score: ${req.ruleBasedScores.technicalTotal}
Overall Bias: ${req.ruleBasedScores.overallBias}
Direction: ${req.ruleBasedScores.direction}

Respond with JSON matching this exact structure:
{
  "confidence": <number between 0 and 100>,
  "signals": [
    {
      "source": "<signal source name>",
      "signal": "bullish" | "bearish" | "neutral",
      "strength": <number between 0 and 100>,
      "description": "<brief reasoning>"
    }
  ],
  "summary": "<one sentence summary>",
  "fundamentalReason": "<1-2 sentences on fundamental score drivers>",
  "technicalReason": "<1-2 sentences on technical score drivers>",
  "keyLevels": { "support": <price number>, "resistance": <price number> },
  "projectedMovePercent": <number 0.1 to 5.0>,
  "riskAssessment": "low" | "medium" | "high",
  "catalysts": ["<catalyst 1>", "<catalyst 2>"]
}`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Prompt construction — batch
// ---------------------------------------------------------------------------

function buildBatchPrompt(req: LLMBatchRequest): string {
  const first = req.instruments[0];

  let prompt = `Analyze the following instruments and provide bias adjustments for each.

--- Shared Macro Context ---
Fear & Greed Index: ${first.fearGreed.value} (${first.fearGreed.label})
DXY (US Dollar Index): ${first.dxy.value} (Change: ${first.dxy.change >= 0 ? "+" : ""}${first.dxy.change.toFixed(2)})

Bond Yields:
${first.bondYields.map((b) => `  ${b.maturity}: ${b.yield.toFixed(3)}% (${b.change >= 0 ? "+" : ""}${b.change.toFixed(3)})`).join("\n")}

Central Bank Stances:
${first.centralBanks.map((cb) => `  ${cb.bank}: Rate ${cb.rate}%, Direction: ${cb.direction}, Stance: ${cb.stance}`).join("\n")}

--- Instruments ---
`;

  for (const inst of req.instruments) {
    prompt += `
${inst.instrument} (${inst.category}):
  Price: ${inst.currentPrice}
  24h Change: ${inst.priceChange24h >= 0 ? "+" : ""}${inst.priceChange24h.toFixed(2)}%
  News: ${inst.newsHeadlines.map((n) => `[${n.sentiment}] ${n.headline}`).join("; ")}
  Rule-Based Scores: Fundamental ${inst.ruleBasedScores.fundamentalTotal}, Technical ${inst.ruleBasedScores.technicalTotal}, Overall ${inst.ruleBasedScores.overallBias} (${inst.ruleBasedScores.direction})
`;
  }

  prompt += `
Respond with JSON. Use the exact instrument names as keys. Keep signals to 2 per instrument with short descriptions.
{"results":{"<instrumentId>":{"confidence":<0-100>,"signals":[{"source":"<name>","signal":"bullish"|"bearish"|"neutral","strength":<0-100>,"description":"<brief>"}],"summary":"<one sentence>","fundamentalReason":"<one sentence>","technicalReason":"<one sentence>","keyLevels":{"support":<price>,"resistance":<price>},"projectedMovePercent":<0.1-5.0>,"riskAssessment":"low"|"medium"|"high","catalysts":["<catalyst>"]}}}

Keys: ${req.instruments.map((i) => `"${i.instrument}"`).join(", ")}`;


  return prompt;
}

// ---------------------------------------------------------------------------
// API calls — Gemini
// ---------------------------------------------------------------------------

async function callGemini(
  key: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error(`Gemini error body: ${errBody}`);
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// ---------------------------------------------------------------------------
// API calls — OpenAI
// ---------------------------------------------------------------------------

async function callOpenAI(
  key: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error(`OpenAI error body: ${errBody}`);
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// API calls — Anthropic (Claude)
// ---------------------------------------------------------------------------

async function callAnthropic(
  key: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  model: string = "claude-sonnet-4-6"
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error(`Anthropic error body: ${errBody}`);
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ---------------------------------------------------------------------------
// Unified call with fallback chain
// ---------------------------------------------------------------------------

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1024,
  anthropicModel: string = "claude-sonnet-4-6"
): Promise<{ text: string; provider: LLMProvider } | null> {
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    console.warn("No LLM API keys configured (GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY)");
    return null;
  }

  console.log(`[LLM] Available providers: ${providers.map((p) => p.provider).join(", ")} | maxTokens: ${maxTokens}`);

  for (const { provider, key } of providers) {
    const rateCheck = checkRateLimit(provider);
    if (!rateCheck.allowed) {
      console.warn(
        `Rate limit reached for ${provider}, retry after ${rateCheck.retryAfterMs}ms`
      );
      continue;
    }

    try {
      console.log(`[LLM] Trying provider: ${provider}`);
      let text: string;
      if (provider === "gemini") {
        text = await callGemini(key, systemPrompt, userPrompt, maxTokens);
      } else if (provider === "anthropic") {
        text = await callAnthropic(key, systemPrompt, userPrompt, maxTokens, anthropicModel);
      } else {
        text = await callOpenAI(key, systemPrompt, userPrompt, maxTokens);
      }
      console.log(`[LLM] Success with provider: ${provider} (response length: ${text.length} chars)`);
      return { text, provider };
    } catch (err) {
      console.error(`[LLM] Failed for ${provider}:`, err);
    }
  }

  console.error("All LLM providers failed");
  return null;
}

// ---------------------------------------------------------------------------
// Server-side in-memory cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const singleCache = new Map<string, CacheEntry<LLMAnalysisResult>>();
const batchCache = new Map<string, CacheEntry<LLMBatchResult>>();

const SINGLE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const BATCH_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCacheKey(req: LLMAnalysisRequest): string {
  return `${req.instrument}:${Math.round(req.currentPrice * 100) / 100}:${Math.round(req.ruleBasedScores.overallBias)}`;
}

function getBatchCacheKey(req: LLMBatchRequest): string {
  return req.instruments.map((i) => `${i.instrument}:${Math.round(i.currentPrice * 100) / 100}`).join("|");
}

function cleanCache<T>(cache: Map<string, CacheEntry<T>>): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expiry) {
      cache.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseSingleResult(raw: string): LLMAnalysisResult | null {
  try {
    const cleaned = stripCodeFences(raw);
    const parsed = JSON.parse(cleaned);

    const signals: LLMSignal[] = (parsed.signals || []).map(
      (s: Record<string, unknown>) => ({
        source: `LLM: ${s.source ?? "Unknown"}`,
        signal: s.signal ?? "neutral",
        strength: clamp(Number(s.strength) || 50, 0, 100),
        description: String(s.description ?? ""),
      })
    );

    return {
      biasAdjustment: 0, // DEPRECATED: LLM no longer influences scoring
      confidence: clamp(Number(parsed.confidence) || 50, 0, 100),
      signals,
      summary: String(parsed.summary ?? ""),
      fundamentalReason: parsed.fundamentalReason ? String(parsed.fundamentalReason) : undefined,
      technicalReason: parsed.technicalReason ? String(parsed.technicalReason) : undefined,
      keyLevels: parsed.keyLevels
        ? { support: Number(parsed.keyLevels.support) || 0, resistance: Number(parsed.keyLevels.resistance) || 0 }
        : undefined,
      projectedMovePercent: parsed.projectedMovePercent
        ? clamp(Number(parsed.projectedMovePercent) || 0, 0, 10)
        : undefined,
      riskAssessment: ["low", "medium", "high"].includes(parsed.riskAssessment)
        ? parsed.riskAssessment
        : undefined,
      catalysts: Array.isArray(parsed.catalysts)
        ? parsed.catalysts.map(String).slice(0, 5)
        : undefined,
    };
  } catch (err) {
    console.error("Failed to parse LLM single response:", err);
    return null;
  }
}

function parseBatchResult(
  raw: string,
  provider: LLMProvider
): LLMBatchResult | null {
  try {
    const cleaned = stripCodeFences(raw);
    const parsed = JSON.parse(cleaned);
    const results: Record<string, LLMAnalysisResult> = {};

    const rawResults = parsed.results ?? parsed;

    for (const [instrumentId, data] of Object.entries(rawResults)) {
      const d = data as Record<string, unknown>;
      const signals: LLMSignal[] = (
        (d.signals as Record<string, unknown>[]) || []
      ).map((s) => ({
        source: `LLM: ${s.source ?? "Unknown"}`,
        signal: (s.signal as LLMSignal["signal"]) ?? "neutral",
        strength: clamp(Number(s.strength) || 50, 0, 100),
        description: String(s.description ?? ""),
      }));

      const kl = d.keyLevels as Record<string, unknown> | undefined;
      results[instrumentId] = {
        biasAdjustment: 0, // DEPRECATED: LLM no longer influences scoring
        confidence: clamp(Number(d.confidence) || 50, 0, 100),
        signals,
        summary: String(d.summary ?? ""),
        fundamentalReason: d.fundamentalReason ? String(d.fundamentalReason) : undefined,
        technicalReason: d.technicalReason ? String(d.technicalReason) : undefined,
        keyLevels: kl
          ? { support: Number(kl.support) || 0, resistance: Number(kl.resistance) || 0 }
          : undefined,
        projectedMovePercent: d.projectedMovePercent
          ? clamp(Number(d.projectedMovePercent) || 0, 0, 10)
          : undefined,
        riskAssessment: ["low", "medium", "high"].includes(d.riskAssessment as string)
          ? (d.riskAssessment as "low" | "medium" | "high")
          : undefined,
        catalysts: Array.isArray(d.catalysts)
          ? (d.catalysts as string[]).map(String).slice(0, 5)
          : undefined,
      };
    }

    return {
      results,
      provider,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error("Failed to parse LLM batch response:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyzeSingleInstrument(
  req: LLMAnalysisRequest
): Promise<LLMAnalysisResult | null> {
  // Check cache
  cleanCache(singleCache);
  const cacheKey = getCacheKey(req);
  const cached = singleCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const userPrompt = buildSinglePrompt(req);
  const response = await callLLM(SINGLE_SYSTEM_PROMPT, userPrompt);
  if (!response) return null;

  const result = parseSingleResult(response.text);
  if (!result) return null;

  // Store in cache
  singleCache.set(cacheKey, {
    data: result,
    expiry: Date.now() + SINGLE_TTL_MS,
  });

  return result;
}

export async function analyzeBatchInstruments(
  req: LLMBatchRequest
): Promise<LLMBatchResult | null> {
  if (!req.instruments || req.instruments.length === 0) return null;

  // Check cache
  cleanCache(batchCache);
  const cacheKey = getBatchCacheKey(req);
  const cached = batchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const userPrompt = buildBatchPrompt(req);
  // Each instrument needs ~300 tokens (signals, summary, reasons, catalysts, key levels, etc.)
  // Plus ~100 tokens for the outer JSON wrapper
  const maxTokens = Math.min(8192, req.instruments.length * 350 + 100);
  // Use Haiku for batch — 10x faster and cheaper than Sonnet, plenty capable for bias adjustments
  const response = await callLLM(BATCH_SYSTEM_PROMPT, userPrompt, maxTokens, "claude-haiku-4-5-20251001");
  if (!response) return null;

  const result = parseBatchResult(response.text, response.provider);
  if (!result) return null;

  // Store in cache
  batchCache.set(cacheKey, {
    data: result,
    expiry: Date.now() + BATCH_TTL_MS,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Market Summary
// ---------------------------------------------------------------------------

const MARKET_SUMMARY_SYSTEM_PROMPT = `You are a senior macro strategist at an institutional trading desk. Provide a concise market overview synthesizing macro data, positioning, and event risk.

Rules:
- Write 2-4 sentences for the overview summarizing the current macro regime, positioning themes, and key drivers.
- Reference COT positioning when available — highlight crowded trades, smart money divergence, and significant weekly shifts.
- Flag high-impact events in the next 24-48 hours that affect tradeable currencies.
- Reference rate differentials and carry conditions when relevant to sector outlook.
- List 2-3 key risks traders should watch (include event risk and positioning risk).
- List 2-3 opportunities the data suggests (include carry-aligned opportunities).
- Provide an overall market outlook: bullish, bearish, or neutral.
- Provide a per-sector outlook breakdown with specific asset mentions for forex, crypto, indices, and commodities.
- For each sector, identify 1-2 specific FOCUS instruments that have the clearest setups today, and any instruments to AVOID.
- Provide a global "focusToday" list: the top 3-5 instruments across all sectors that deserve attention today.
- Provide a "sitOutToday" list: instruments or conditions where the right move is to sit on your hands. Be willing to say "no clear setups" for entire sectors if conditions are unclear or choppy.
- CRITICAL: Align recommendations with the mechanical instrument bias scores provided. If an instrument has a clear bearish bias (bias <= -20), do NOT recommend it as a LONG opportunity. If it has a clear bullish bias (bias >= 20), do NOT recommend it as a SHORT. The mechanical signals reflect actual price action — respect them even when macro narrative suggests otherwise.
- Be specific — reference actual data values (DXY level, fear/greed, yield curve, COT extremes, rate differentials).
- Respond with valid JSON only.`;

function buildMarketSummaryPrompt(req: MarketSummaryRequest): string {
  const yieldCurveSpread =
    req.bondYields.length >= 2
      ? (() => {
          const sorted = [...req.bondYields].sort(
            (a, b) => parseFloat(a.maturity) - parseFloat(b.maturity)
          );
          return (sorted[sorted.length - 1].yield - sorted[0].yield).toFixed(3);
        })()
      : "N/A";

  return `Provide a macro market summary based on the following data.

--- Current Market Data ---
Fear & Greed Index: ${req.fearGreed.value} (${req.fearGreed.label})
DXY (US Dollar Index): ${req.dxy.value} (Change: ${req.dxy.change >= 0 ? "+" : ""}${req.dxy.change.toFixed(2)})

Bond Yields:
${req.bondYields.map((b) => `  ${b.maturity}: ${b.yield.toFixed(3)}% (${b.change >= 0 ? "+" : ""}${b.change.toFixed(3)})`).join("\n")}
Yield Curve Spread (long - short): ${yieldCurveSpread}

Central Bank Stances:
${req.centralBanks.map((cb) => `  ${cb.bank}: Rate ${cb.rate}%, Direction: ${cb.direction}, Stance: ${cb.stance}`).join("\n")}

Top News Headlines:
${req.newsHeadlines.map((n) => `  - [${n.sentiment}, score: ${n.score}] ${n.headline}`).join("\n")}
${req.instrumentBiases && req.instrumentBiases.length > 0 ? `
--- Current Instrument Biases ---
${req.instrumentBiases.map((b) => `  ${b.symbol} (${b.category}): ${b.direction} (bias: ${b.bias})`).join("\n")}` : ""}
${req.cotPositioning && req.cotPositioning.length > 0 ? `
--- COT Speculative Positioning ---
${req.cotPositioning.map((c) => {
  const extreme = c.percentLong > 70 ? " (CROWDED LONG)" : c.percentLong < 30 ? " (CROWDED SHORT)" : "";
  return `  ${c.currency}: ${c.percentLong}% long${extreme} | W/W: ${c.netSpecChange > 0 ? "+" : ""}${c.netSpecChange.toLocaleString()} | Commercial: ${c.netCommercial > 0 ? "+" : ""}${c.netCommercial.toLocaleString()}`;
}).join("\n")}` : ""}
${req.highImpactEvents && req.highImpactEvents.length > 0 ? `
--- High-Impact Events This Week ---
${req.highImpactEvents.map((e) => `  ${e.date} ${e.time || "TBD"} | ${e.currency} | ${e.event}`).join("\n")}` : ""}
${req.rateDifferentials && req.rateDifferentials.length > 0 ? `
--- Rate Differentials ---
${req.rateDifferentials.map((rd) => `  ${rd.pair}: ${rd.differential > 0 ? "+" : ""}${rd.differential}% → carry favors ${rd.carryDirection}`).join("\n")}` : ""}

Respond with JSON:
{
  "overview": "<2-4 sentence macro summary>",
  "risks": ["<risk 1>", "<risk 2>"],
  "opportunities": ["<opportunity 1>", "<opportunity 2>"],
  "outlook": "bullish" | "bearish" | "neutral",
  "sectorOutlook": [
    {
      "sector": "forex" | "crypto" | "indices" | "commodities",
      "outlook": "bullish" | "bearish" | "neutral",
      "keyAssets": ["<asset — brief reason>", "<asset — brief reason>"],
      "focusPairs": ["<instrument — why it deserves focus>"],
      "avoidPairs": ["<instrument — why to avoid>"]
    }
  ],
  "focusToday": ["EURUSD", "XAUUSD"],
  "sitOutToday": ["Crypto — no clear regime", "GBPJPY — choppy price action"]
}`;
}

const summaryCache = new Map<string, CacheEntry<MarketSummaryResult>>();
const SUMMARY_TTL_MS = 5 * 60 * 1000;

function getSummaryCacheKey(req: MarketSummaryRequest): string {
  const cotFingerprint = (req.cotPositioning ?? []).slice(0, 3).map((c) => c.netSpeculative).join(",");
  const newsFingerprint = (req.newsHeadlines ?? []).slice(0, 5).map((n) => n.headline.slice(0, 20)).join("|");
  return `${Math.round(req.dxy.value)}:${req.fearGreed.value}:cot:${cotFingerprint}:news:${newsFingerprint}`;
}

function parseMarketSummary(
  raw: string,
  provider: LLMProvider
): MarketSummaryResult | null {
  try {
    const cleaned = stripCodeFences(raw);
    const parsed = JSON.parse(cleaned);
    const outlook = parsed.outlook;
    return {
      overview: String(parsed.overview ?? ""),
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String).slice(0, 5) : [],
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.map(String).slice(0, 5) : [],
      outlook: outlook === "bullish" || outlook === "bearish" || outlook === "neutral" ? outlook : "neutral",
      sectorOutlook: Array.isArray(parsed.sectorOutlook)
        ? parsed.sectorOutlook.map((s: Record<string, unknown>) => ({
            sector: String(s.sector ?? ""),
            outlook: (["bullish", "bearish", "neutral"].includes(s.outlook as string) ? s.outlook : "neutral") as "bullish" | "bearish" | "neutral",
            keyAssets: Array.isArray(s.keyAssets) ? (s.keyAssets as string[]).map(String).slice(0, 5) : [],
            focusPairs: Array.isArray(s.focusPairs) ? (s.focusPairs as string[]).map(String).slice(0, 3) : undefined,
            avoidPairs: Array.isArray(s.avoidPairs) ? (s.avoidPairs as string[]).map(String).slice(0, 3) : undefined,
          }))
        : undefined,
      focusToday: Array.isArray(parsed.focusToday) ? (parsed.focusToday as string[]).map(String).slice(0, 5) : undefined,
      sitOutToday: Array.isArray(parsed.sitOutToday) ? (parsed.sitOutToday as string[]).map(String).slice(0, 5) : undefined,
      timestamp: Date.now(),
      provider,
    };
  } catch (err) {
    console.error("Failed to parse market summary:", err);
    return null;
  }
}

export async function generateMarketSummary(
  req: MarketSummaryRequest
): Promise<MarketSummaryResult | null> {
  cleanCache(summaryCache);
  const cacheKey = getSummaryCacheKey(req);
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const userPrompt = buildMarketSummaryPrompt(req);
  const response = await callLLM(MARKET_SUMMARY_SYSTEM_PROMPT, userPrompt, 2048);
  if (!response) return null;

  const result = parseMarketSummary(response.text, response.provider);
  if (!result) return null;

  summaryCache.set(cacheKey, { data: result, expiry: Date.now() + SUMMARY_TTL_MS });
  return result;
}

// ---------------------------------------------------------------------------
// Deep Analysis — Zone Analysis (analysis only, no trade ideas)
// ---------------------------------------------------------------------------

import type { DeepAnalysisLLMResult } from "@/lib/types/deep-analysis";

const DEEP_ANALYSIS_SYSTEM_PROMPT = `You are an elite price action and order flow analyst at a prop trading desk. Given supply/demand zones, Fair Value Gaps (ICT concepts), confluence levels, and technical context, provide zone analysis commentary.

Rules:
- Do NOT generate trade ideas, entries, stop losses, or take profits. The mechanical system handles trade generation.
- Identify which supply/demand zones are most significant and why (significantZones).
- List 2-3 key levels to watch for confirmation or rejection (keyLevelsToWatch).
- Provide a brief summary of the overall price structure.
- Provide a zoneAnalysis: 1-3 sentences analyzing how the zones interact with current price action and what that implies structurally.
- Respond with valid JSON only.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDeepAnalysisPrompt(req: any): string {
  let prompt = `Analyze ${req.symbol} (${req.category}) and provide zone analysis based on the following data.

Current Price: ${req.currentPrice}

--- Supply/Demand Zones ---
Supply Zones (resistance/selling pressure):
${(req.supplyZones || []).map((z: { priceHigh: number; priceLow: number; strength: number; freshness: string; impulseMagnitude: number }) =>
  `  ${z.priceLow.toFixed(req.currentPrice > 100 ? 2 : 5)} – ${z.priceHigh.toFixed(req.currentPrice > 100 ? 2 : 5)} (strength: ${z.strength}, ${z.freshness}, ${z.impulseMagnitude.toFixed(1)}x ATR)`
).join("\n") || "  None detected"}

Demand Zones (support/buying pressure):
${(req.demandZones || []).map((z: { priceHigh: number; priceLow: number; strength: number; freshness: string; impulseMagnitude: number }) =>
  `  ${z.priceLow.toFixed(req.currentPrice > 100 ? 2 : 5)} – ${z.priceHigh.toFixed(req.currentPrice > 100 ? 2 : 5)} (strength: ${z.strength}, ${z.freshness}, ${z.impulseMagnitude.toFixed(1)}x ATR)`
).join("\n") || "  None detected"}

--- Fair Value Gaps (ICT) ---
${(req.fairValueGaps || []).map((f: { type: string; high: number; low: number; midpoint: number; freshness: string; sizeATR: number; strength: number }) =>
  `  ${f.type} FVG: ${f.low.toFixed(req.currentPrice > 100 ? 2 : 5)} – ${f.high.toFixed(req.currentPrice > 100 ? 2 : 5)} (CE: ${f.midpoint.toFixed(req.currentPrice > 100 ? 2 : 5)}, ${f.freshness}, ${f.sizeATR.toFixed(1)}x ATR, strength: ${f.strength})`
).join("\n") || "  None detected"}

--- Confluence Levels ---
${(req.confluenceLevels || []).map((l: { price: number; score: number; type: string; sources: { name: string }[] }) =>
  `  ${l.price.toFixed(req.currentPrice > 100 ? 2 : 5)} (${l.type}, score: ${l.score}) — ${l.sources.map((s: { name: string }) => s.name).join(", ")}`
).join("\n") || "  None detected"}
`;

  if (req.trend) {
    prompt += `
--- Trend ---
Direction: ${req.trend.direction} | Pattern: ${req.trend.pattern} | Strength: ${req.trend.strength}
`;
  }

  if (req.rsi) {
    prompt += `RSI: ${req.rsi.value.toFixed(1)} (${req.rsi.signal})
`;
  }

  if (req.macd) {
    prompt += `MACD Histogram: ${req.macd.histogram.toFixed(4)} | Crossover: ${req.macd.crossover || "none"}
`;
  }

  if (req.bias) {
    prompt += `
--- Bias ---
Overall: ${req.bias.overall} | Direction: ${req.bias.direction} | Confidence: ${req.bias.confidence}%
`;
  }

  if (req.fearGreed) {
    prompt += `Fear & Greed: ${req.fearGreed.value} (${req.fearGreed.label})
`;
  }

  if (req.news && req.news.length > 0) {
    prompt += `
--- Recent News ---
${req.news.map((n: { headline: string; sentiment: string }) => `  [${n.sentiment}] ${n.headline}`).join("\n")}
`;
  }

  prompt += `
Respond with JSON:
{
  "significantZones": ["<zone description>"],
  "keyLevelsToWatch": ["<level to watch>"],
  "summary": "<brief price structure summary>",
  "zoneAnalysis": "<1-3 sentences on how zones interact with current price>"
}`;

  return prompt;
}

function parseDeepAnalysisResult(raw: string): DeepAnalysisLLMResult | null {
  try {
    const cleaned = stripCodeFences(raw);
    const parsed = JSON.parse(cleaned);

    return {
      tradeIdeas: [], // DEPRECATED: LLM no longer generates trade ideas
      significantZones: Array.isArray(parsed.significantZones)
        ? parsed.significantZones.map(String).slice(0, 5)
        : [],
      keyLevelsToWatch: Array.isArray(parsed.keyLevelsToWatch)
        ? parsed.keyLevelsToWatch.map(String).slice(0, 5)
        : [],
      summary: String(parsed.summary ?? ""),
      zoneAnalysis: parsed.zoneAnalysis ? String(parsed.zoneAnalysis) : undefined,
    };
  } catch (err) {
    console.error("Failed to parse deep analysis response:", err);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function analyzeDeepAnalysis(req: any): Promise<DeepAnalysisLLMResult | null> {
  const userPrompt = buildDeepAnalysisPrompt(req);
  // Use Sonnet for quality — this is single-instrument deep analysis
  const response = await callLLM(DEEP_ANALYSIS_SYSTEM_PROMPT, userPrompt, 1536);
  if (!response) return null;

  return parseDeepAnalysisResult(response.text);
}

// ---------------------------------------------------------------------------
// Trading Advisor — Virtual Desk Manager
// ---------------------------------------------------------------------------

import type { TradingAdvisorRequest, TradingAdvisorResult, DeskChatRequest, DeskChatResponse } from "@/lib/types/llm";

const TRADING_ADVISOR_SYSTEM_PROMPT = `You are a senior institutional risk auditor at a multi-strategy prop desk. You review a book of FX, commodities, indices, and crypto positions. Your job is to identify RISKS, CONFLICTS, and WARNINGS that the mechanical trading system may not capture. You are a risk auditor, NOT a decision maker.

CRITICAL: You do NOT pick trades, rank setups, or recommend entries. The mechanical system handles all trade selection and ranking. Your role is purely advisory — flag risks, warn about conflicts, and provide portfolio-level commentary.

Your risk assessment framework:
- PORTFOLIO CONCENTRATION: Flag when the book is heavy in one currency or direction. Concentrated USD exposure across 3+ pairs is a risk. Diversification score below 50 requires defensive posture.
- EVENT RISK: High-impact events (NFP, CPI, rate decisions) within 24 hours affecting any setup must be flagged. Reference specific events, currencies, and timing.
- POSITIONING CONFLICTS: When COT speculative positioning is extreme (>70% or <30% long), flag the crowded trade risk. When commercial hedgers oppose speculators, flag the smart money divergence.
- CARRY HEADWINDS: When a setup fights negative carry, flag the cost. In risk-off environments (fear/greed < 25), flag carry unwind risk for AUD, NZD, and EM currencies.
- CORRELATION RISK: When multiple setups have correlated exposure, flag the hidden concentration. If correlation warnings exist in portfolio data, they must be addressed.
- REGIME RISK: Distribution or reversal phases with high volatility deserve explicit warnings. Accumulation with tight Bollinger bands means potential breakout in either direction.

COT INTERPRETATION:
- Speculative net long > 70% = crowded long — flag reversal risk
- Commercial hedgers opposing speculators = smart money divergence — flag this
- Net spec change > 15K week-over-week = significant sentiment shift — flag this

Your style:
- Direct, concise, and authoritative — like a risk manager at the morning meeting
- Reference specific data: COT positioning, rate differentials, event risk, portfolio exposure
- Use institutional language naturally (e.g. "the book is heavy USD", "crowded long", "event risk ahead", "reduce gross exposure")
- Be honest about uncertainty — if data conflicts, say so
- Always think portfolio-first

CRITICAL RULE — INSTRUMENT NAMES:
- You may ONLY reference instruments that appear in the "Mechanical Setups" list below.
- Use the EXACT symbol provided. Never invent or modify symbols.

Rules:
- greeting: 1 sentence setting the tone (reference dominant macro theme or risk condition)
- marketRegime: 2-3 sentences assessing the overall risk environment, referencing portfolio exposure, carry conditions, and event calendar
- riskFlags: 3-5 specific risk observations. Each flag should reference specific data (e.g. "USD concentrated across 3 long positions", "NFP in 4 hours — EUR/USD event-exposed", "AUD/USD fighting negative carry in risk-off environment"). Be specific, not generic.
- focusToday: Top 3-5 instruments with direction (LONG/SHORT) from the mechanical setups — copy these from the highest-conviction mechanical setups, do NOT rerank them.
- sitOutToday: 1-3 instruments or conditions to sit out — reference positioning, event risk, or portfolio concentration
- avoidList: 1-2 instruments to avoid with specific data-backed reasoning
- riskWarning: Key portfolio-level risk — reference specific exposure, correlation, or event data
- deskNote: One specific institutional insight connecting today's conditions to risk management — not a generic truism
- Respond with valid JSON only.`;

function buildTradingAdvisorPrompt(req: TradingAdvisorRequest): string {
  let prompt = `Provide your desk manager briefing based on the following mechanical signal data.

--- Market Overview ---
Regime Summary: ${req.regimeSummary}
System Consensus: ${req.consensusSummary}
Impulse Distribution: ${req.impulseSummary}
Fear & Greed: ${req.fearGreed.value} (${req.fearGreed.label})
DXY: ${req.dxy.value} (${req.dxy.change >= 0 ? "+" : ""}${req.dxy.change.toFixed(2)})
Risk: ${req.riskPercent}% per trade (percentage-based position sizing)

Bond Yields:
${req.bondYields.map((b) => `  ${b.maturity}: ${b.yield.toFixed(3)}% (${b.change >= 0 ? "+" : ""}${b.change.toFixed(3)})`).join("\n")}
`;

  // Central Bank Rates & Carry
  if (req.centralBanks && req.centralBanks.length > 0) {
    prompt += `\n--- Central Bank Rates ---\n`;
    prompt += req.centralBanks
      .map((cb) => `  ${cb.bank} (${cb.currency}): ${cb.rate}% | ${cb.direction} | ${cb.stance}`)
      .join("\n");
    prompt += "\n";
  }

  if (req.rateDifferentials && req.rateDifferentials.length > 0) {
    prompt += `\n--- Rate Differentials & Carry ---\n`;
    prompt += req.rateDifferentials
      .map(
        (rd) =>
          `  ${rd.pair}: ${rd.baseCurrency} ${rd.baseRate}% vs ${rd.quoteCurrency} ${rd.quoteRate}% = ${rd.differential > 0 ? "+" : ""}${rd.differential}% → carry favors ${rd.carryDirection}`
      )
      .join("\n");
    prompt += "\n";
  }

  // COT Positioning
  if (req.cotPositioning && req.cotPositioning.length > 0) {
    prompt += `\n--- COT Speculative Positioning (CFTC) ---\n`;
    prompt += req.cotPositioning
      .map((c) => {
        const extreme = c.percentLong > 70 ? " *** CROWDED LONG" : c.percentLong < 30 ? " *** CROWDED SHORT" : "";
        const changeDir = c.netSpecChange > 0 ? "+" : "";
        return `  ${c.currency}: Net spec ${c.netSpeculative > 0 ? "+" : ""}${c.netSpeculative.toLocaleString()} | ${c.percentLong}% long${extreme} | W/W: ${changeDir}${c.netSpecChange.toLocaleString()} | Commercial: ${c.netCommercial > 0 ? "+" : ""}${c.netCommercial.toLocaleString()}`;
      })
      .join("\n");
    prompt += "\n";
  }

  // High-Impact Events
  if (req.highImpactEvents && req.highImpactEvents.length > 0) {
    prompt += `\n--- High-Impact Events (Event Risk) ---\n`;
    prompt += req.highImpactEvents
      .map((e) => {
        const fvp = e.forecast != null && e.previous != null
          ? ` | Forecast: ${e.forecast} vs Previous: ${e.previous}`
          : "";
        return `  ${e.date} ${e.time || "TBD"} | ${e.currency} | ${e.event}${fvp}`;
      })
      .join("\n");
    prompt += "\n";
  }

  // Portfolio Risk
  if (req.portfolioRisk) {
    const pr = req.portfolioRisk;
    prompt += `\n--- Portfolio Risk (Current Book) ---\n`;
    prompt += `  Concentration Risk: ${pr.concentrationRisk.toUpperCase()} | Diversification: ${pr.diversificationScore}/100\n`;
    if (pr.exposures.length > 0) {
      prompt += `  Currency Exposures:\n`;
      prompt += pr.exposures
        .map((e) => `    ${e.currency}: ${e.netExposure > 0 ? "+" : ""}${e.netExposure.toFixed(2)} (${e.netExposure > 0 ? "net long" : e.netExposure < 0 ? "net short" : "flat"})`)
        .join("\n");
      prompt += "\n";
    }
    if (pr.warnings.length > 0) {
      prompt += `  Portfolio Warnings:\n`;
      prompt += pr.warnings
        .map((w) => `    [${w.severity.toUpperCase()}] ${w.message}`)
        .join("\n");
      prompt += "\n";
    }
  }

  prompt += `
--- Mechanical Setups (for risk review) ---
`;

  for (const setup of req.setups) {
    const statusLine = setup.trackedStatus ? `  Trade Status: ${setup.trackedStatus}` : "";
    prompt += `
${setup.symbol} (${setup.category}) — ${setup.conviction} conviction (score: ${setup.convictionScore})
  Direction: ${setup.direction} | Regime: ${setup.regime} (ADX ${setup.adx.toFixed(0)}) | Impulse: ${setup.impulse}
  Signals: ${setup.signalsSummary}
  Systems agreeing: ${setup.systemsAgreeing.join(", ") || "none"}
  Price: ${setup.currentPrice} | Entry: ${setup.entry} | SL: ${setup.stopLoss} | TP: ${setup.takeProfit}
  R:R: ${setup.riskReward} | Size: ${setup.positionSize}`;

    // MTF alignment
    if (setup.mtfAlignment) {
      const pbStr = setup.pullbackComplete ? " | Pullback complete" : "";
      prompt += `\n  MTF: ${setup.mtfAlignment} alignment (Daily: ${setup.mtfDaily ?? "—"})${pbStr}`;
    }

    // Market structure
    if (setup.structureBias) {
      const bosStr = setup.lastBOS ? ` | Last BOS: ${setup.lastBOS.direction} at ${setup.lastBOS.price}` : "";
      const chochStr = setup.lastCHoCH ? ` | Last CHoCH: ${setup.lastCHoCH.direction} at ${setup.lastCHoCH.price}` : "";
      prompt += `\n  Structure: ${setup.structureBias} (score ${setup.structureScore ?? 0})${bosStr}${chochStr}`;
    }

    // ICT context
    if (setup.ictScore != null) {
      const fvgStr = setup.nearestFVG ? ` | FVG (${setup.nearestFVG.type}, ${setup.nearestFVG.freshness}) at ${setup.nearestFVG.midpoint}` : "";
      const obStr = setup.nearestOB ? ` | OB (${setup.nearestOB.type}, strength ${setup.nearestOB.strength})` : "";
      const dispStr = setup.displacement ? " | Displacement: YES" : "";
      prompt += `\n  ICT: Score ${setup.ictScore}${fvgStr}${obStr}${dispStr}`;
    }

    // Entry optimization
    if (setup.bestEntryPattern) {
      const pbDepthStr = setup.pullbackDepth != null ? ` | Pullback ${(setup.pullbackDepth * 100).toFixed(0)}%` : "";
      prompt += `\n  Entry: Best pattern: ${setup.bestEntryPattern} | Entry score: ${setup.entryScore ?? 0}/100${pbDepthStr}`;
    }

    // Volatility / Wyckoff phase
    if (setup.volatilityRegime || setup.wyckoffPhase) {
      const volStr = setup.volatilityRegime ? `Volatility: ${setup.volatilityRegime}` : "";
      const phaseStr = setup.wyckoffPhase ? `Phase: ${setup.wyckoffPhase}` : "";
      const adxTrendStr = setup.adxTrend ? `ADX: ${setup.adxTrend}` : "";
      prompt += `\n  ${[volStr, phaseStr, adxTrendStr].filter(Boolean).join(" | ")}`;
    }

    // Learning / confluence history
    if (setup.learningWinRate != null && setup.learningTrades != null && setup.learningTrades > 0) {
      prompt += `\n  Learning: ${(setup.learningWinRate * 100).toFixed(0)}% win rate over ${setup.learningTrades} trades for this confluence pattern`;
    }

    if (statusLine) prompt += `\n${statusLine}`;
    prompt += "\n";
  }

  // Managed positions (context only — not for top pick selection)
  if (req.managedSetups && req.managedSetups.length > 0) {
    prompt += `\n--- Currently Managed Positions (DO NOT recommend entering these) ---\n`;
    for (const m of req.managedSetups) {
      prompt += `  ${m.symbol}: ${m.direction} — ${m.status}\n`;
    }
  }

  prompt += `
Respond with JSON:
{
  "greeting": "<1 sentence — reference dominant macro theme, positioning shift, or event risk>",
  "marketRegime": "<2-3 sentences — reference portfolio exposure, carry conditions, event calendar, COT shifts>",
  "riskFlags": ["<3-5 specific risk observations — e.g. 'EUR/USD: crowded long + NFP tomorrow = elevated event risk', 'XAU/USD: negative carry in contango, position sizing should reflect'>"],
  "focusToday": [{"symbol": "EUR/USD", "action": "LONG"}, {"symbol": "XAU/USD", "action": "SHORT"}],
  "sitOutToday": ["AUD/USD — event risk (NFP tomorrow), crowded long positioning"],
  "avoidList": ["<instrument — reference positioning, correlation, event, or technical data>"],
  "riskWarning": "<portfolio-level risk — reference exposure, correlation, or event data>",
  "deskNote": "<specific institutional insight connecting today's conditions to the framework>"
}`;

  return prompt;
}

const advisorCache = new Map<string, CacheEntry<TradingAdvisorResult>>();
const ADVISOR_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getAdvisorCacheKey(req: TradingAdvisorRequest): string {
  const setupPart = req.setups.map((s) => `${s.instrument}:${s.conviction}:${s.direction}:${s.impulse}:${s.trackedStatus ?? "new"}`).join("|");
  const managedPart = (req.managedSetups ?? []).map((m) => `${m.symbol}:${m.status}`).join("|");
  const cotPart = (req.cotPositioning ?? []).map((c) => `${c.currency}:${c.netSpeculative}`).join(",");
  const eventCount = req.highImpactEvents?.length ?? 0;
  const riskPart = req.portfolioRisk ? `${req.portfolioRisk.concentrationRisk}:${req.portfolioRisk.diversificationScore}` : "";
  return `advisor:${setupPart}|m:${managedPart}|cot:${cotPart}|ev:${eventCount}|risk:${riskPart}`;
}

function parseAdvisorResult(raw: string, provider: LLMProvider): TradingAdvisorResult | null {
  try {
    const cleaned = stripCodeFences(raw);
    const parsed = JSON.parse(cleaned);

    return {
      greeting: String(parsed.greeting ?? ""),
      marketRegime: String(parsed.marketRegime ?? ""),
      topPick: null, // DEPRECATED: LLM no longer picks trades
      otherSetups: [], // DEPRECATED: LLM no longer ranks setups
      riskFlags: Array.isArray(parsed.riskFlags)
        ? parsed.riskFlags.map(String).slice(0, 6)
        : [],
      avoidList: Array.isArray(parsed.avoidList)
        ? parsed.avoidList.map(String).slice(0, 3)
        : [],
      focusToday: Array.isArray(parsed.focusToday)
        ? parsed.focusToday
            .filter((f: unknown) => f && typeof f === "object" && "symbol" in (f as Record<string, unknown>))
            .map((f: { symbol: string; action?: string }) => ({
              symbol: String(f.symbol),
              action: (f.action === "SHORT" ? "SHORT" : "LONG") as "LONG" | "SHORT",
            }))
            .slice(0, 5)
        : [],
      sitOutToday: Array.isArray(parsed.sitOutToday)
        ? parsed.sitOutToday.map(String).slice(0, 5)
        : [],
      riskWarning: String(parsed.riskWarning ?? ""),
      deskNote: String(parsed.deskNote ?? ""),
      timestamp: Date.now(),
      provider,
    };
  } catch (err) {
    console.error("Failed to parse trading advisor response:", err);
    return null;
  }
}

export async function generateTradingAdvisor(
  req: TradingAdvisorRequest
): Promise<TradingAdvisorResult | null> {
  cleanCache(advisorCache);
  const cacheKey = getAdvisorCacheKey(req);
  const cached = advisorCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const userPrompt = buildTradingAdvisorPrompt(req);
  // Use Opus for maximum reasoning quality — this is the highest-stakes LLM call in the system
  const response = await callLLM(TRADING_ADVISOR_SYSTEM_PROMPT, userPrompt, 2560, "claude-opus-4-6");
  if (!response) return null;

  const result = parseAdvisorResult(response.text, response.provider);
  if (!result) return null;

  advisorCache.set(cacheKey, { data: result, expiry: Date.now() + ADVISOR_TTL_MS });
  return result;
}

// ---------------------------------------------------------------------------
// Desk Chat — Conversational Multi-Turn
// ---------------------------------------------------------------------------

const DESK_CHAT_SYSTEM_PROMPT_SUFFIX = `

--- CHAT MODE ---
You are now in conversational mode. The trader is asking follow-up questions about the data above.
- Be concise. Max 2-3 sentences unless they ask for detail.
- Reference the specific instrument data, COT positioning, rate differentials, event risk, and portfolio exposure above when answering.
- If they ask about positioning, carry, or event risk, use the institutional data provided.
- If they ask about an instrument, use the exact data provided.
- If they ask about something not in the data, say so honestly.
- Keep your desk manager personality: direct, professional, institutional trading language.
- Do NOT return JSON. Respond in natural language.`;

export async function generateDeskChatReply(
  req: DeskChatRequest
): Promise<DeskChatResponse | null> {
  const providers = getAvailableProviders();
  const anthropicProvider = providers.find((p) => p.provider === "anthropic");
  if (!anthropicProvider) return null;

  const rateCheck = checkRateLimit("anthropic");
  if (!rateCheck.allowed) return null;

  // System prompt: full desk manager persona + all current setup data + chat mode instructions
  const contextPrompt = buildTradingAdvisorPrompt(req.context);
  const systemPrompt = TRADING_ADVISOR_SYSTEM_PROMPT + "\n\n--- CURRENT DESK DATA ---\n" + contextPrompt + DESK_CHAT_SYSTEM_PROMPT_SUFFIX;

  // Convert to Anthropic message format, cap at 20 messages
  const messages = req.messages
    .slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  try {
    console.log(`[Desk Chat] Sending ${messages.length} messages to Opus`);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicProvider.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 512,
        temperature: 0.4,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`[Desk Chat] Anthropic error: ${response.status} ${errBody}`);
      return null;
    }

    const data = await response.json();
    const reply = data.content[0].text;
    console.log(`[Desk Chat] Reply generated (${reply.length} chars)`);

    return {
      reply,
      provider: "anthropic",
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error("[Desk Chat] Error:", err);
    return null;
  }
}
