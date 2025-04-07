export function ShimmerFallback() {
  return (
    <div className="isolate overflow-hidden rounded-lg">
      <div className="relative before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent">
        <div className="space-y-6">
          <div className="flex justify-between">
            <div className="h-10 w-2/5 rounded-lg bg-gray-100"></div>
            <div className="h-10 w-1/5 rounded-lg bg-gray-100"></div>
          </div>
          <div className="flex h-80 items-end justify-center gap-4 rounded-lg bg-gray-50 p-6" />
        </div>
      </div>
    </div>
  );
}
