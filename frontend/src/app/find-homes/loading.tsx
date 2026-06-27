import { Skeleton } from "@/components/ui/skeleton";

export default function FindHomesLoading() {
  return (
    <div className="flex gap-6 p-6 min-h-screen">
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex flex-col gap-4 w-64 shrink-0">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>

      {/* Cards skeleton */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
