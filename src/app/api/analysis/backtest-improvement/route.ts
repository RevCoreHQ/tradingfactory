import { NextRequest, NextResponse } from "next/server";
import type { BacktestStats, Weakness, ParameterAdjustment, SystemBreakdown, RegimeBreakdown } from "@/lib/types/backtest";

const SYSTEM_PROMPT = `You are a quantitative trading system optimizer. Given backtest statistics, identified weaknesses, and performance breakdowns, suggest specific parameter adjustments to improve the trading system.

Rules:
- Suggest 3-6 specific parameter adjustments
- Each adjustment must target a specific parameter with current and suggested values
- Focus on the most impactful changes first
- Be conservative — small incremental improvements over radical changes
- Never suggest removing safety gates (impulse gate, conviction filter) entirely
- Consider the interaction between adjustments (e.g. widening SL + tightening TP)
- Provide clear reasoning for each suggestion
- Respond with valid JSON only.`;

function buildPrompt(req: {
  stats: BacktestStats;
  weaknesses: Weakness[];
  systemBreakdown: SystemBreakdown[];
  regimeBreakdown: RegimeBreakdown[];
}): string {
  return `Analyze these backtest results and suggest parameter improvements.

--- Performance Statistics ---
Total Trades: ${req.stats.totalTrades}
Win Rate: ${(req.stats.winRate * 100).toFixed(1)}%
Expectancy: ${req.stats.expectancy.toFixed(3)}R
Profit Factor: ${req.stats.profitFactor.toFixed(2)}
Sharpe Ratio: ${req.stats.sharpeRatio.toFixed(2)}
Max Drawdown: ${req.stats.maxDrawdownPercent.toFixed(1)}%
Total Return: ${req.stats.totalReturnPercent.toFixed(1)}%
Avg Win: ${req.stats.avgWinR.toFixed(2)}R | Avg Loss: -${req.stats.avgLossR.toFixed(2)}R
Consecutive Wins: ${req.stats.consecutiveWins} | Consecutive Losses: ${req.stats.consecutiveLosses}

--- Identified Weaknesses ---
${req.weaknesses.map((w, i) => `${i + 1}. [${w.severity.toUpperCase()}] ${w.area}: ${w.description}
   Evidence: ${w.evidence}
   Suggested: ${w.suggestedFix}`).join("\n\n")}

--- System Performance ---
${req.systemBreakdown.map((s) => `${s.system}: WR ${(s.winRate * 100).toFixed(0)}% | Exp ${s.expectancy.toFixed(2)}R | PF ${s.profitFactor.toFixed(2)} | ${s.trades} trades`).join("\n")}

--- Regime Performance ---
${req.regimeBreakdown.map((r) => `${r.regime}: WR ${(r.winRate * 100).toFixed(0)}% | Exp ${r.expectancy.toFixed(2)}R | PF ${r.profitFactor.toFixed(2)} | ${r.trades} trades`).join("\n")}

--- Available Parameters ---
- slMultiplier.swing (current: 2.0, range: 1.0-3.0) — ATR multiplier for stop loss
- slMultiplier.intraday (current: 1.5, range: 1.0-2.5)
- tpMultiplier.tp1 (current: 1.5R, range: 1.0-2.5R)
- tpMultiplier.tp2 (current: 2.5R, range: 1.5-4.0R)
- tpMultiplier.tp3 (current: 3.5R, range: 2.0-5.0R)
- minConviction (current: A, options: A+/A/B/C)
- minRiskReward (current: 1.5, range: 1.0-3.0)
- entrySpreadMultiplier (current: 0.5, range: 0.2-1.0)
- system.[name].weight (current: 1.0, range: 0.0-1.5) — per signal system
- ictWeight (current: 1.0, range: 0.0-2.0) — ICT confluence contribution

Respond with JSON:
{
  "suggestions": [
    {
      "parameter": "<parameter path>",
      "currentValue": "<current>",
      "suggestedValue": "<suggested>",
      "reasoning": "<why this helps>",
      "impact": "high" | "medium" | "low",
      "category": "risk" | "entry" | "exit" | "filter" | "system_weight"
    }
  ],
  "summary": "<1-2 sentence overall assessment>",
  "confidence": <0-100>
}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callLLM(systemPrompt: string, userPrompt: string): Promise<any> {
  // Try Anthropic first, then Gemini, then OpenAI
  if (process.env.ANTHROPIC_API_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return JSON.parse(data.content[0].text.replace(/^```json\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim());
    }
  }

  if (process.env.GEMINI_API_KEY) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 1024 },
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      return JSON.parse(data.candidates[0].content.parts[0].text);
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stats, weaknesses, systemBreakdown, regimeBreakdown } = body;

    if (!stats || !weaknesses) {
      return NextResponse.json({ error: "Missing stats or weaknesses" }, { status: 400 });
    }

    const prompt = buildPrompt({ stats, weaknesses, systemBreakdown, regimeBreakdown });
    const result = await callLLM(SYSTEM_PROMPT, prompt);

    if (!result) {
      return NextResponse.json({ error: "LLM call failed" }, { status: 502 });
    }

    const suggestions: ParameterAdjustment[] = (result.suggestions || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => ({
        parameter: String(s.parameter ?? ""),
        currentValue: s.currentValue ?? "",
        suggestedValue: s.suggestedValue ?? "",
        reasoning: String(s.reasoning ?? ""),
        impact: ["high", "medium", "low"].includes(s.impact) ? s.impact : "medium",
        category: ["risk", "entry", "exit", "filter", "system_weight"].includes(s.category) ? s.category : "risk",
      })
    );

    return NextResponse.json({
      suggestions,
      summary: String(result.summary ?? ""),
      confidence: Math.min(100, Math.max(0, Number(result.confidence) || 50)),
    });
  } catch (err) {
    console.error("Backtest improvement error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
