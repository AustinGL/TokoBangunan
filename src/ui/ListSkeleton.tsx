type Props = { label: string; rows?: number }

/** Shaped placeholders while a live query resolves. Static under reduced motion. */
export function ListSkeleton({ label, rows = 4 }: Props) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className="skeleton h-20 rounded-card" />
      ))}
    </div>
  )
}
