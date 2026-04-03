export default function SkeletonCard({ lines = 3 }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="h-4 bg-subtle rounded w-2/3 mb-3" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <div key={i} className="h-3 bg-subtle/50 rounded w-full mb-2" />
      ))}
    </div>
  )
}
