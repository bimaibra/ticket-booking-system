import { cn } from "@/shared/lib/cn";

export function EventCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-line bg-surface",
        className
      )}
      aria-hidden
    >
      <div className="aspect-[16/10] w-full bg-subtle animate-pulse" />
      <div className="flex flex-col gap-4 p-6">
        <div className="h-5 w-3/4 rounded-md bg-subtle animate-pulse" />
        <div className="mt-2 flex flex-col gap-2">
          <div className="h-3 w-2/3 rounded-md bg-subtle animate-pulse" />
          <div className="h-3 w-1/2 rounded-md bg-subtle animate-pulse" />
        </div>
        <div className="h-3 w-24 rounded-md bg-subtle animate-pulse" />
      </div>
    </div>
  );
}