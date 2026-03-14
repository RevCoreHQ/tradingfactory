"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function BiasGaugeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <Skeleton className="h-40 w-64 rounded-full shimmer" />
      <Skeleton className="h-8 w-24 shimmer" />
      <Skeleton className="h-4 w-32 shimmer" />
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <Skeleton className="h-4 w-1/3 shimmer" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3 shimmer" style={{ width: `${80 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="glass-card rounded-xl p-4">
      <Skeleton className="h-4 w-1/4 mb-4 shimmer" />
      <Skeleton className="h-48 w-full shimmer" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass-card rounded-xl p-4 space-y-2">
      <Skeleton className="h-4 w-1/3 mb-3 shimmer" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full shimmer" />
      ))}
    </div>
  );
}

export function InstrumentCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16 shimmer" />
        <Skeleton className="h-4 w-20 shimmer" />
      </div>
      <Skeleton className="h-16 w-16 rounded-full mx-auto shimmer" />
      <Skeleton className="h-3 w-12 mx-auto shimmer" />
    </div>
  );
}
