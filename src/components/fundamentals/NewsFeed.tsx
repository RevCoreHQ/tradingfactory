"use client";

import { useMarketNews } from "@/lib/hooks/useMarketData";
import { GlassCard } from "@/components/common/GlassCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CardSkeleton } from "@/components/common/Skeletons";
import { formatRelativeTime } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";

export function NewsFeed() {
  const { data, isLoading } = useMarketNews();

  if (isLoading) {
    return <CardSkeleton lines={8} />;
  }

  const news = data?.items || [];
  const sentiment = data?.aggregateSentiment;

  return (
    <GlassCard className="h-full" delay={0.15}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Market News</h3>
        {sentiment && (
          <StatusBadge
            variant={sentiment.biasScore > 55 ? "bullish" : sentiment.biasScore < 45 ? "bearish" : "neutral"}
            pulse
          >
            Sentiment: {sentiment.biasScore.toFixed(0)}
          </StatusBadge>
        )}
      </div>

      <ScrollArea className="h-[400px] lg:h-[500px]">
        <div className="space-y-2 pr-3">
          {news.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Add API keys in .env.local to see live news
            </p>
          )}
          {news.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "block rounded-lg p-3 transition-colors hover:bg-white/5",
                "border-l-2",
                item.sentimentLabel === "bullish" ? "border-l-bullish" : item.sentimentLabel === "bearish" ? "border-l-bearish" : "border-l-muted"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed">
                  {item.headline}
                </h4>
                <StatusBadge
                  variant={item.sentimentLabel === "bullish" ? "bullish" : item.sentimentLabel === "bearish" ? "bearish" : "neutral"}
                  className="shrink-0 text-[10px]"
                >
                  {item.sentimentLabel}
                </StatusBadge>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-muted-foreground">{item.source}</span>
                <span className="text-[10px] text-muted-foreground/50">·</span>
                <span className="text-[10px] text-muted-foreground">{formatRelativeTime(item.publishedAt)}</span>
              </div>
            </a>
          ))}
        </div>
      </ScrollArea>
    </GlassCard>
  );
}
