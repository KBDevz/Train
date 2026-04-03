import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUnits } from '../contexts/UnitsContext'
import { fetchExerciseLibrary } from '../lib/programService'
import { supabase } from '../lib/supabase'
import { Search, Plus, X, ChevronLeft, Dumbbell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SkeletonCard from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Full Body', 'Other']

export default function ExerciseLibraryScreen() {
  const { user } = useAuth()
  const { convertWeight, unitLabel } = useUnits()
  const navigate = useNavigate()
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('Other')
  const [newType, setNewType] = useState('compound')
  const [selectedEx, setSelectedEx] = useState(null)
  const [exHistory, setExHistory] = useState([])

  useEffect(() => {
    if (user) loadExercises()
  }, [user])

  async function loadExercises() {
    setLoading(true)
    try {
      const data = await fetchExerciseLibrary(user.id)
      setExercises(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function loadExHistory(exerciseId) {
    const { data } = await supabase
      .from('session_sets')
      .select(`
        *,
        sessions!inner (user_id, started_at, finished_at)
      `)
      .eq('sessions.user_id', user.id)
      .eq('exercise_id', exerciseId)
      .not('sessions.finished_at', 'is', null)
      .order('sessions(started_at)', { ascending: false })
      .limit(25)
    setExHistory(data || [])
  }

  const addExercise = async () => {
    if (!newName.trim()) return
    await supabase.from('exercises').insert({
      user_id: user.id,
      name: newName,
      muscle_group: newGroup,
      movement_type: newType,
    })
    setNewName('')
    setShowAdd(false)
    loadExercises()
  }

  const filtered = exercises.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase())
    const matchGroup = filter === 'All' || e.muscle_group?.toLowerCase() === filter.toLowerCase()
    return matchSearch && matchGroup
  })

  // PR for selected exercise
  const pr = exHistory.reduce((max, set) => {
    if (set.completed && set.weight > max) return set.weight
    return max
  }, 0)

  if (loading) {
    return (
      <div className="screen-container px-4 pt-6 space-y-3">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  // Exercise detail view
  if (selectedEx) {
    const sessions = exHistory.reduce((acc, set) => {
      const date = new Date(set.sessions?.started_at).toLocaleDateString()
      if (!acc[date]) acc[date] = []
      acc[date].push(set)
      return acc
    }, {})

    return (
      <div className="screen-container px-4 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setSelectedEx(null)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-card border border-border text-text">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-text">{selectedEx.name}</h1>
            <p className="text-xs text-muted">{selectedEx.muscle_group} · {selectedEx.movement_type}</p>
          </div>
        </div>

        {pr > 0 && (
          <div className="bg-primary-dim border border-primary/20 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Personal Record</p>
            <p className="text-2xl font-bold text-text">{convertWeight(pr)} {unitLabel}</p>
          </div>
        )}

        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Recent Sessions</h3>
        {Object.keys(sessions).length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No history for this exercise yet</p>
        ) : (
          Object.entries(sessions).slice(0, 5).map(([date, sets]) => (
            <div key={date} className="bg-card border border-border rounded-xl p-3 mb-2">
              <p className="text-xs font-medium text-muted mb-1">{date}</p>
              <div className="flex flex-wrap gap-2">
                {sets.sort((a, b) => a.set_number - b.set_number).map((set, i) => (
                  <span key={i} className={`text-xs px-2 py-1 rounded ${set.completed ? 'bg-success-light text-text-secondary' : 'bg-subtle text-muted'}`}>
                    {set.weight ? convertWeight(set.weight) : '—'}×{set.reps || '—'}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <div className="screen-container px-4 pt-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-card border border-border text-text">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-text flex-1">Exercise Library</h1>
        <button onClick={() => setShowAdd(true)} className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-bg">
          <Plus size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-card text-text text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted"
          placeholder="Search exercises..."
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 no-scrollbar">
        {MUSCLE_GROUPS.map(g => (
          <button
            key={g}
            onClick={() => setFilter(g)}
            className={`px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === g ? 'bg-primary text-bg' : 'bg-card border border-border text-text-secondary'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState icon={Dumbbell} title="No exercises found" description="Try a different search or add a custom exercise" />
      ) : (
        <div className="space-y-1">
          {filtered.map(ex => (
            <button
              key={ex.id}
              onClick={() => { setSelectedEx(ex); loadExHistory(ex.id) }}
              className="w-full text-left px-3 py-3 rounded-xl bg-card border border-border flex items-center gap-3 hover:bg-card-hover transition-colors"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-text">{ex.name}</p>
                <p className="text-xs text-muted">{ex.muscle_group}{ex.is_global && ' · Global'}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add Exercise Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-bg/80 z-50 flex items-center justify-center px-6">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text">Add Exercise</h2>
              <button onClick={() => setShowAdd(false)}><X size={20} className="text-muted" /></button>
            </div>
            <div className="space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-border bg-card text-text text-base focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted"
                placeholder="Exercise name"
                autoFocus
              />
              <select
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-border text-base bg-card text-text focus:outline-none"
              >
                {MUSCLE_GROUPS.filter(g => g !== 'All').map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-border text-base bg-card text-text focus:outline-none"
              >
                <option value="compound">Compound</option>
                <option value="isolation">Isolation</option>
                <option value="bodyweight">Bodyweight</option>
                <option value="cardio">Cardio</option>
              </select>
              <button
                onClick={addExercise}
                disabled={!newName.trim()}
                className="w-full h-12 bg-primary text-bg font-semibold rounded-xl disabled:opacity-40"
              >
                Add Exercise
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
