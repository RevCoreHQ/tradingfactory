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

const SINGLE_SYSTEM_PROMPT = `You are an elite quantitative market analyst at a prop trading desk. Your role is to evaluate financial instruments and provide actionable trading intelligence that modifies an existing rule-based scoring system.

Rules:
- Return a biasAdjustment value between -50 and +50.
  - Positive values mean you believe the instrument is MORE BULLISH than the rules suggest.
  - Negative values mean you believe the instrument is MORE BEARISH than the rules suggest.
  - 0 means you agree with the current rule-based assessment.
  - Use the full range: ±40-50 for very strong conviction, ±20-40 for moderate, ±1-20 for minor.
- Provide 2-5 signals, each with a source name, signal direction (bullish/bearish/neutral), strength (0-100), and a brief description explaining your reasoning.
- Include a confidence score (0-100) indicating how confident you are in your adjustment.
- Include a short summary sentence (one sentence max).
- Include keyLevels: the most important support and resistance price levels you identify.
- Include projectedMovePercent: your estimate of likely % move in the direction of bias (0.1 to 5.0).
- Include riskAssessment: "low", "medium", or "high" — how risky is this trade setup?
- Include catalysts: 1-3 upcoming events or factors that could trigger the move.
- Respond with valid JSON only. Do not include any markdown formatting or explanation outside the JSON.`;

const BATCH_SYSTEM_PROMPT = `You are an elite quantitative market analyst. Evaluate multiple instruments and provide bias adjustments for each. Be concise — keep each instrument's analysis compact.

Rules per instrument:
- biasAdjustment: number -50 to +50 (positive = more bullish than rules, negative = more bearish)
- confidence: 0-100
- signals: exactly 2 signals per instrument (keep descriptions under 15 words)
- summary: one short sentence
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
  "biasAdjustment": <number between -50 and 50>,
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
{"results":{"<instrumentId>":{"biasAdjustment":<-50 to 50>,"confidence":<0-100>,"signals":[{"source":"<name>","signal":"bullish"|"bearish"|"neutral","strength":<0-100>,"description":"<brief>"}],"summary":"<one sentence>","keyLevels":{"support":<price>,"resistance":<price>},"projectedMovePercent":<0.1-5.0>,"riskAssessment":"low"|"medium"|"high","catalysts":["<catalyst>"]}}}

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
      biasAdjustment: clamp(Number(parsed.biasAdjustment) || 0, -50, 50),
      confidence: clamp(Number(parsed.confidence) || 50, 0, 100),
      signals,
      summary: String(parsed.summary ?? ""),
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
        biasAdjustment: clamp(Number(d.biasAdjustment) || 0, -50, 50),
        confidence: clamp(Number(d.confidence) || 50, 0, 100),
        signals,
        summary: String(d.summary ?? ""),
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
  // Each instrument needs ~200 tokens (signals, summary, catalysts, key levels, etc.)
  // Plus ~100 tokens for the outer JSON wrapper
  const maxTokens = Math.min(8192, req.instruments.length * 250 + 100);
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

const MARKET_SUMMARY_SYSTEM_PROMPT = `You are a senior macro strategist. Provide a concise market overview based on the data provided.

Rules:
- Write 2-4 sentences for the overview summarizing the current macro regime and key drivers.
- List 2-3 key risks traders should watch.
- List 2-3 opportunities the data suggests.
- Provide an overall market outlook: bullish, bearish, or neutral.
- Provide a per-sector outlook breakdown with specific asset mentions for forex, crypto, indices, and commodities.
- For each sector, identify 1-2 specific FOCUS instruments that have the clearest setups today, and any instruments to AVOID.
- Provide a global "focusToday" list: the top 3-5 instruments across all sectors that deserve attention today.
- Provide a "sitOutToday" list: instruments or conditions where the right move is to sit on your hands. Be willing to say "no clear setups" for entire sectors if conditions are unclear or choppy.
- Be specific — reference actual data values (DXY level, fear/greed reading, yield curve state) and name specific instruments.
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
const SUMMARY_TTL_MS = 10 * 60 * 1000;

function getSummaryCacheKey(req: MarketSummaryRequest): string {
  return `${Math.round(req.dxy.value)}:${req.fearGreed.value}`;
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
// Deep Analysis — AI Trade Ideas from S/D zones + confluence
// ---------------------------------------------------------------------------

import type { DeepAnalysisLLMResult, AITradeIdea } from "@/lib/types/deep-analysis";

const DEEP_ANALYSIS_SYSTEM_PROMPT = `You are an elite price action and order flow analyst at a prop trading desk. Given supply/demand zones, Fair Value Gaps (ICT concepts), confluence levels, and technical context, provide specific actionable trade ideas.

Rules:
- Provide 2-3 specific trade ideas, each with:
  - direction: "long" or "short"
  - entry: exact price level
  - stopLoss: exact price level (beyond the nearest S/D zone)
  - takeProfit: exact price level (target the next significant zone/level)
  - riskReward: calculated R:R ratio (minimum 1.5)
  - rationale: 1-2 sentences explaining the trade thesis
  - confluenceFactors: list of supporting levels/zones at the entry
  - confidence: 0-100
  - timeframe: "scalp", "intraday", or "swing"
- Identify which supply/demand zones are most significant and why (significantZones).
- List 2-3 key levels to watch for confirmation before entering (keyLevelsToWatch).
- Provide a brief summary of the overall price structure.
- Respond with valid JSON only.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDeepAnalysisPrompt(req: any): string {
  let prompt = `Analyze ${req.symbol} (${req.category}) and provide trade ideas based on the following data.

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
  "tradeIdeas": [
    {
      "direction": "long" | "short",
      "entry": <price>,
      "stopLoss": <price>,
      "takeProfit": <price>,
      "riskReward": <number>,
      "rationale": "<1-2 sentences>",
      "confluenceFactors": ["<factor 1>", "<factor 2>"],
      "confidence": <0-100>,
      "timeframe": "scalp" | "intraday" | "swing"
    }
  ],
  "significantZones": ["<zone description>"],
  "keyLevelsToWatch": ["<level to watch>"],
  "summary": "<brief price structure summary>"
}`;

  return prompt;
}

function parseDeepAnalysisResult(raw: string): DeepAnalysisLLMResult | null {
  try {
    const cleaned = stripCodeFences(raw);
    const parsed = JSON.parse(cleaned);

    const tradeIdeas: AITradeIdea[] = (parsed.tradeIdeas || []).map(
      (t: Record<string, unknown>) => ({
        direction: t.direction === "short" ? "short" : "long",
        entry: Number(t.entry) || 0,
        stopLoss: Number(t.stopLoss) || 0,
        takeProfit: Number(t.takeProfit) || 0,
        riskReward: clamp(Number(t.riskReward) || 0, 0, 20),
        rationale: String(t.rationale ?? ""),
        confluenceFactors: Array.isArray(t.confluenceFactors)
          ? (t.confluenceFactors as string[]).map(String).slice(0, 5)
          : [],
        confidence: clamp(Number(t.confidence) || 50, 0, 100),
        timeframe: String(t.timeframe ?? "intraday"),
      })
    );

    return {
      tradeIdeas,
      significantZones: Array.isArray(parsed.significantZones)
        ? parsed.significantZones.map(String).slice(0, 5)
        : [],
      keyLevelsToWatch: Array.isArray(parsed.keyLevelsToWatch)
        ? parsed.keyLevelsToWatch.map(String).slice(0, 5)
        : [],
      summary: String(parsed.summary ?? ""),
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

const TRADING_ADVISOR_SYSTEM_PROMPT = `You are a senior trading desk manager with 20+ years of experience at a prop trading firm. You advise traders based on mechanical system signals, market regime data, and risk parameters derived from 8 professional trading books (Trading In The Zone, Trade Like a Casino, Mechanical Trading Systems, The PlayBook, One Good Trade, Best Loser Wins, Market Wizards, Trading for a Living).

Your style:
- Direct, concise, and actionable — like a real desk manager speaking to traders at the morning meeting
- Reference specific data points in your reasoning: MTF alignment, ICT score, structure score, entry patterns, learning win rates
- Use trading desk language naturally (e.g. "the tape looks heavy", "clean setup", "chop zone")
- Be honest about uncertainty — if signals are mixed, say so
- Always emphasize risk management (the 2% rule, position sizing, when to sit out)

DECISION FRAMEWORK — Weighted Priority (use this to rank setups):
1. MTF Alignment (30%): "full" alignment = all timeframes agree. This is the strongest edge. "conflicting" = DO NOT TRADE.
2. ICT Confluence (25%): FVG reentry + order block retest + displacement = institutional money flow. ICT score 70+ is high conviction.
3. Market Structure (20%): Positive structureScore for longs, negative for shorts. BOS confirms trend. CHoCH = early reversal signal.
4. Signal Count + Conviction (15%): A+ conviction with 5+ systems agreeing is strong. But without MTF/structure support, it's just noise.
5. Entry Pattern Quality (10%): Engulfing > Pin Bar > Inside Bar for reversal entries. FVG reentry and OB retest are institutional-grade patterns.

ICT EMPHASIS — These are HIGH PRIORITY confirmations:
- FVG reentry (price returns to fill a Fair Value Gap) = smart money is accumulating/distributing
- Order Block retest = institutional level being defended
- Displacement (large candle with body > 70% of range) = aggressive institutional activity
- When ICT score > 70 AND MTF alignment is "full" or "strong", this is an A++ setup

ANTI-PATTERNS — Hard rules:
- NEVER recommend a setup with "conflicting" MTF alignment
- Setups where market structure opposes the trade direction (negative structureScore for longs, positive for shorts) are AVOID setups
- If volatility regime is "high" AND Wyckoff phase is "distribution" or "markdown", REDUCE position sizes or sit out
- If the learning system shows < 40% win rate over 15+ trades for a confluence pattern, AVOID that setup

LEARNING INTEGRATION:
- If a confluence pattern has 60%+ win rate over 20+ trades, this is PROVEN edge — weight it heavily
- If learning data shows 50-60% win rate, it's marginal — only take with strong ICT + MTF confirmation
- Reference the learning data in your reasoning when available

WYCKOFF PHASE STRATEGY:
- Expansion: ride the trend, trail stops — best environment for swing trades
- Accumulation: position early with tight risk — potential for breakout
- Distribution: tighten stops, take profits, prepare for reversal — defensive posture
- Markdown: defense mode — only counter-trend scalps or sit out entirely

CRITICAL RULE — INSTRUMENT NAMES:
- You may ONLY reference instruments that appear in the "Actionable Setups" list below.
- Use the EXACT symbol provided (e.g. "XAU/USD", "EUR/USD", "BTC/USD"). Never invent or modify symbols.
- Do NOT reference instruments that are not in the list. If an instrument is not listed, it does not exist in this system.
- topPick.instrument MUST be copied exactly from the symbol field of one of the actionable setups below.

Rules:
- greeting: 1 sentence setting the tone for the session (reference market regime, dominant theme, or Wyckoff phase)
- marketRegime: 2-3 sentences assessing the overall market regime across instruments, referencing MTF alignment distribution and volatility conditions
- topPick: Your #1 ACTIONABLE setup. Only from the "Actionable Setups" section. Explain WHY based on the mechanical data — reference MTF alignment, ICT score, structure, entry pattern quality, and learning data. Be specific. topPick.instrument must match the symbol EXACTLY.
- otherSetups: 2-3 one-sentence notes on other actionable setups worth watching
- avoidList: 1-2 instruments/situations to avoid and why — reference the specific data that makes them dangerous (conflicting MTF, negative structure score, high volatility + distribution, etc.)
- riskWarning: Key risk to watch right now (reference specific regime, volatility, or correlation data)
- deskNote: One piece of wisdom from the 8 books — connect it specifically to today's conditions using the data provided
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

--- Actionable Setups (ranked by conviction) ---
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
  "greeting": "<1 sentence opening — reference the dominant theme or regime>",
  "marketRegime": "<2-3 sentence regime assessment referencing MTF alignment distribution and volatility>",
  "topPick": {
    "instrument": "<EXACT symbol from actionable setups>",
    "action": "LONG" | "SHORT",
    "conviction": "<tier>",
    "reasoning": "<2-3 sentences — reference specific MTF alignment, ICT score, structure score, entry pattern, learning data>",
    "levels": "<entry, SL, TP summary>"
  },
  "otherSetups": ["<1 sentence each for 2-3 other actionable setups>"],
  "avoidList": ["<instrument/situation — reference the specific data making it dangerous>"],
  "riskWarning": "<key risk with specific data reference>",
  "deskNote": "<wisdom from the 8 trading books connected to today's specific conditions>"
}`;

  return prompt;
}

const advisorCache = new Map<string, CacheEntry<TradingAdvisorResult>>();
const ADVISOR_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getAdvisorCacheKey(req: TradingAdvisorRequest): string {
  const setupPart = req.setups.map((s) => `${s.instrument}:${s.conviction}:${s.direction}:${s.impulse}:${s.trackedStatus ?? "new"}`).join("|");
  const managedPart = (req.managedSetups ?? []).map((m) => `${m.symbol}:${m.status}`).join("|");
  return `advisor:${setupPart}|m:${managedPart}`;
}

function parseAdvisorResult(raw: string, provider: LLMProvider): TradingAdvisorResult | null {
  try {
    const cleaned = stripCodeFences(raw);
    const parsed = JSON.parse(cleaned);

    return {
      greeting: String(parsed.greeting ?? ""),
      marketRegime: String(parsed.marketRegime ?? ""),
      topPick: parsed.topPick
        ? {
            instrument: String(parsed.topPick.instrument ?? ""),
            action: String(parsed.topPick.action ?? ""),
            conviction: String(parsed.topPick.conviction ?? ""),
            reasoning: String(parsed.topPick.reasoning ?? ""),
            levels: String(parsed.topPick.levels ?? ""),
          }
        : null,
      otherSetups: Array.isArray(parsed.otherSetups)
        ? parsed.otherSetups.map(String).slice(0, 4)
        : [],
      avoidList: Array.isArray(parsed.avoidList)
        ? parsed.avoidList.map(String).slice(0, 3)
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
  const response = await callLLM(TRADING_ADVISOR_SYSTEM_PROMPT, userPrompt, 2048, "claude-opus-4-6");
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
- Reference the specific instrument data above when answering.
- If they ask about an instrument, use the exact data provided.
- If they ask about something not in the data, say so honestly.
- Keep your desk manager personality: direct, professional, trading desk language.
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
