export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton animate-pulse rounded-lg ${className}`} aria-hidden="true" />;
}
