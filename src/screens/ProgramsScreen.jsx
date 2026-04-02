import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { fetchPrograms } from '../lib/programService'
import { ClipboardList, Plus, Zap, ChevronRight } from 'lucide-react'
import SkeletonCard from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'

export default function ProgramsScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchPrograms(user.id).then(setPrograms).catch(console.error).finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="screen-container px-4 pt-6 space-y-3">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  return (
    <div className="screen-container px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Programs</h1>
        <button
          onClick={() => navigate('/programs/create')}
          className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white"
        >
          <Plus size={20} />
        </button>
      </div>

      {programs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No programs yet"
          description="Create a program manually or let AI build one for you"
          action={
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/programs/create')}
                className="h-10 px-4 bg-white border border-border rounded-lg text-sm font-medium"
              >
                Create Manual
              </button>
              <button
                onClick={() => navigate('/coach')}
                className="h-10 px-4 bg-primary text-white rounded-lg text-sm font-medium flex items-center gap-1"
              >
                <Zap size={14} /> AI Generate
              </button>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/programs/${p.id}`)}
              className="w-full bg-white rounded-xl p-4 text-left flex items-center gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-slate-800">{p.name}</p>
                  {p.ai_generated && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">AI</span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {p.days_per_week} days/week · {p.weeks} weeks
                  {p.category && ` · ${p.category}`}
                </p>
              </div>
              <ChevronRight size={16} className="text-muted" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
