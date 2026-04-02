export default function SkeletonCard({ lines = 3 }) {
  return (
    <div className="bg-white rounded-xl p-4 animate-pulse">
      <div className="h-5 bg-slate-200 rounded w-2/3 mb-3" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <div key={i} className="h-4 bg-slate-100 rounded w-full mb-2" />
      ))}
    </div>
  )
}
