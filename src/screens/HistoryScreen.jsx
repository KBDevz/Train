import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUnits } from '../contexts/UnitsContext'
import { fetchSessions } from '../lib/sessionService'
import { Clock, ChevronDown, ChevronUp } from 'lucide-react'
import SkeletonCard from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'

export default function HistoryScreen() {
  const { user } = useAuth()
  const { convertWeight, unitLabel } = useUnits()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!user) return
    fetchSessions(user.id)
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const formatDuration = (seconds) => {
    if (!seconds) return '--'
    const m = Math.floor(seconds / 60)
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
  }

  if (loading) {
    return (
      <div className="screen-container px-4 pt-6 space-y-3">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  return (
    <div className="screen-container px-4 pt-6">
      <h1 className="text-xl font-bold text-slate-900 mb-4">History</h1>

      {sessions.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No workouts yet"
          description="Complete your first workout to see it here"
        />
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const totalVol = s.session_sets?.reduce((sum, set) =>
              sum + (set.completed && set.weight && set.reps ? set.weight * set.reps : 0), 0) || 0
            const setsCompleted = s.session_sets?.filter(set => set.completed).length || 0
            const exerciseNames = [...new Set(s.session_sets?.map(set => set.exercises?.name).filter(Boolean))]
            const isExpanded = expanded === s.id

            return (
              <div key={s.id} className="bg-white rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : s.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-slate-800 text-sm">{s.workout_days?.name || 'Workout'}</p>
                    {isExpanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
                  </div>
                  <p className="text-xs text-muted mb-2">
                    {new Date(s.started_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {s.programs?.name && ` · ${s.programs.name}`}
                  </p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-slate-600">⏱ {formatDuration(s.duration_seconds)}</span>
                    <span className="text-slate-600">📊 {convertWeight(totalVol).toLocaleString()} {unitLabel}</span>
                    <span className="text-slate-600">✓ {setsCompleted} sets</span>
                  </div>
                  {!isExpanded && exerciseNames.length > 0 && (
                    <p className="text-xs text-muted mt-1.5 truncate">{exerciseNames.join(', ')}</p>
                  )}
                </button>

                {isExpanded && s.session_sets && (
                  <div className="px-4 pb-4 border-t border-border/50">
                    {Object.entries(
                      s.session_sets.reduce((acc, set) => {
                        const name = set.exercises?.name || 'Unknown'
                        if (!acc[name]) acc[name] = []
                        acc[name].push(set)
                        return acc
                      }, {})
                    ).map(([name, sets]) => (
                      <div key={name} className="mt-3">
                        <p className="text-sm font-medium text-slate-700 mb-1">{name}</p>
                        {sets.sort((a, b) => a.set_number - b.set_number).map((set) => (
                          <div key={set.id} className="flex items-center gap-2 text-xs py-0.5">
                            <span className="w-6 text-muted">#{set.set_number}</span>
                            <span className={`${set.completed ? 'text-slate-700' : 'text-muted line-through'}`}>
                              {set.weight ? `${convertWeight(set.weight)} ${unitLabel}` : '—'} × {set.reps || '—'}
                            </span>
                            {set.completed && <span className="text-success">✓</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                    {s.feedback_rating && (
                      <p className="text-xs text-muted mt-3">
                        Feedback: {['', '😴', '🙂', '💪', '🔥'][s.feedback_rating]}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
