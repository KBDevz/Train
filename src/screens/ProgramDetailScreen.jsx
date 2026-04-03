import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchProgramDetail, deleteProgram } from '../lib/programService'
import { useUnits } from '../contexts/UnitsContext'
import { ChevronLeft, Play, Trash2 } from 'lucide-react'
import SkeletonCard from '../components/SkeletonCard'

export default function ProgramDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { convertWeight, unitLabel } = useUnits()
  const [program, setProgram] = useState(null)
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedDay, setExpandedDay] = useState(null)

  useEffect(() => {
    fetchProgramDetail(id)
      .then(({ program, days }) => {
        setProgram(program)
        setDays(days || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!confirm('Delete this program? This cannot be undone.')) return
    await deleteProgram(id)
    navigate('/programs', { replace: true })
  }

  if (loading) {
    return (
      <div className="screen-container px-4 pt-6 space-y-3">
        <SkeletonCard lines={4} /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (!program) {
    return <div className="screen-container px-4 pt-6"><p className="text-text">Program not found</p></div>
  }

  const rationale = program.description?.split('\n\nRationale: ')[1]
  const description = program.description?.split('\n\nRationale: ')[0]

  return (
    <div className="screen-container px-4 pt-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/programs')} className="w-9 h-9 flex items-center justify-center rounded-lg bg-card border border-border text-text">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-text">{program.name}</h1>
          <p className="text-xs text-muted">{program.days_per_week} days/week · {program.weeks} weeks</p>
        </div>
        <button onClick={handleDelete} className="w-9 h-9 flex items-center justify-center rounded-lg text-danger">
          <Trash2 size={18} />
        </button>
      </div>

      {description && <p className="text-sm text-text-secondary mb-3">{description}</p>}
      {rationale && (
        <div className="bg-primary-dim border border-primary/20 rounded-xl p-3 mb-4">
          <p className="text-xs font-semibold text-primary mb-1">AI Rationale</p>
          <p className="text-sm text-text-secondary">{rationale}</p>
        </div>
      )}

      {/* Workout Days */}
      <h2 className="text-xs uppercase tracking-wider text-text-secondary mb-2">Workout Days</h2>
      <div className="space-y-2">
        {days.map((day) => (
          <div key={day.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedDay(expandedDay === day.id ? null : day.id)}
              className="w-full p-4 flex items-center gap-3 text-left active:bg-card-hover"
            >
              <div className="w-8 h-8 bg-primary-dim rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{day.order_index + 1}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-text">{day.name}</p>
                <p className="text-xs text-muted">{day.workout_exercises?.length || 0} exercises</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate('/workout', { state: { day, program } })
                }}
                className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-bg"
              >
                <Play size={14} />
              </button>
            </button>

            {expandedDay === day.id && (
              <div className="px-4 pb-4 space-y-2 border-t border-border">
                {day.workout_exercises?.map((we) => (
                  <div key={we.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-text">{we.exercises?.name || 'Exercise'}</p>
                      <p className="text-xs text-muted">{we.exercises?.muscle_group}</p>
                    </div>
                    <p className="text-sm text-text-secondary">
                      {we.target_sets}×{we.target_reps}
                      {we.target_weight > 0 && ` @ ${convertWeight(we.target_weight)} ${unitLabel}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
