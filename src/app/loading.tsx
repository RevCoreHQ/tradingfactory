export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <header className="bg-[var(--surface-1)] border-b border-border/50 px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-7 w-7 shimmer rounded-lg" />
            <div className="h-5 w-32 shimmer rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-7 w-36 shimmer rounded-lg" />
            <div className="h-7 w-7 shimmer rounded-lg" />
            <div className="h-6 w-14 shimmer rounded-lg" />
          </div>
        </div>
      </header>

      {/* Market hours skeleton */}
      <div className="border-b border-border/50 px-6 py-1.5">
        <div className="max-w-[1400px] mx-auto flex items-center gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3 w-24 shimmer rounded" />
          ))}
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-8">
        {/* Section 1: Market Pulse skeleton */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-7 w-7 shimmer rounded-lg" />
            <div className="h-4 w-28 shimmer rounded" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="section-card p-4 h-28 shimmer" />
            ))}
          </div>
        </section>

        {/* Section 2: AI Intelligence skeleton */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-7 w-7 shimmer rounded-lg" />
            <div className="h-4 w-32 shimmer rounded" />
          </div>
          <div className="section-card p-5">
            <div className="space-y-3">
              <div className="h-4 w-3/4 shimmer rounded" />
              <div className="h-4 w-full shimmer rounded" />
              <div className="h-4 w-2/3 shimmer rounded" />
            </div>
          </div>
        </section>

        {/* Section 3: Top Opportunities skeleton */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-7 w-7 shimmer rounded-lg" />
            <div className="h-4 w-36 shimmer rounded" />
          </div>
          <div className="section-card p-5">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-36 shimmer rounded-lg" />
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: Risk Calendar skeleton */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-7 w-7 shimmer rounded-lg" />
            <div className="h-4 w-28 shimmer rounded" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 section-card p-5 h-48 shimmer" />
            <div className="lg:col-span-5 section-card p-5 h-48 shimmer" />
          </div>
        </section>
      </main>
    </div>
  );
}
