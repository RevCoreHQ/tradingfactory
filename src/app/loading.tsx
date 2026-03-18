export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <header className="bg-[var(--surface-0)] border-b border-border px-4 py-2.5">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-5 w-28 shimmer rounded" />
            <div className="h-4 w-16 shimmer rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-36 shimmer rounded-full" />
            <div className="h-3 w-10 shimmer rounded" />
          </div>
        </div>
      </header>

      {/* Market hours skeleton */}
      <div className="border-b border-border px-4 py-1.5">
        <div className="max-w-[1800px] mx-auto flex items-center gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3 w-20 shimmer rounded" />
          ))}
        </div>
      </div>

      <main className="max-w-[1800px] mx-auto px-4 py-4 space-y-4">
        {/* Conviction board skeleton */}
        <div className="panel rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 w-40 shimmer rounded" />
            <div className="h-4 w-24 shimmer rounded" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-36 shimmer rounded-lg" />
            ))}
          </div>
        </div>

        {/* AI summary skeleton */}
        <div className="panel rounded-lg p-4">
          <div className="h-4 w-36 shimmer rounded mb-3" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-2">
              <div className="h-3 w-full shimmer rounded" />
              <div className="h-3 w-5/6 shimmer rounded" />
              <div className="h-3 w-2/3 shimmer rounded" />
              <div className="h-5 w-16 shimmer rounded mt-2" />
            </div>
            <div className="lg:col-span-5 space-y-3">
              <div className="h-3 w-20 shimmer rounded" />
              <div className="h-3 w-full shimmer rounded" />
              <div className="h-3 w-3/4 shimmer rounded" />
            </div>
          </div>
        </div>

        {/* Supporting context skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3 panel rounded-lg p-4 h-40 shimmer" />
          <div className="lg:col-span-5 panel rounded-lg p-4 h-40 shimmer" />
          <div className="lg:col-span-4 panel rounded-lg p-4 h-40 shimmer" />
        </div>

        {/* Bottom row skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 panel rounded-lg p-4 h-48 shimmer" />
          <div className="lg:col-span-4 panel rounded-lg p-4 h-48 shimmer" />
        </div>
      </main>
    </div>
  );
}
