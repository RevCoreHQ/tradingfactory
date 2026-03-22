export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-black">
      <span className="text-2xl md:text-4xl font-mono font-medium text-black dark:text-white loading-scramble">
        Welcome to Trading Factory
      </span>
    </div>
  );
}
