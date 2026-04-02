import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchExerciseLibrary } from '../lib/programService'
import { generateProgram } from '../lib/ai'
import { saveProgramToDb } from '../lib/programService'
import { ChevronLeft, Plus, X, Zap, Search } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function CreateProgramScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState(null) // null | 'manual' | 'ai'
  const [loading, setLoading] = useState(false)
  const [exercises, setExercises] = useState([])

  // Manual form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [weeks, setWeeks] = useState(4)
  const [workoutDays, setWorkoutDays] = useState([])
  const [showExSearch, setShowExSearch] = useState(null) // day index
  const [exSearch, setExSearch] = useState('')

  useEffect(() => {
    if (user) fetchExerciseLibrary(user.id).then(setExercises).catch(console.error)
  }, [user])

  const handleAiGenerate = async () => {
    setLoading(true)
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!profile) {
        navigate('/onboarding')
        return
      }

      const result = await generateProgram(profile)
      await saveProgramToDb(user.id, result.program)
      navigate('/programs', { replace: true })
    } catch (err) {
      console.error(err)
      alert('Failed to generate program. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const addDay = () => {
    setWorkoutDays([...workoutDays, { name: `Day ${workoutDays.length + 1}`, exercises: [] }])
  }

  const addExerciseToDay = (dayIdx, exercise) => {
    const updated = [...workoutDays]
    updated[dayIdx].exercises.push({
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      muscle_group: exercise.muscle_group,
      target_sets: 3,
      target_reps: 10,
      target_weight: 0,
    })
    setWorkoutDays(updated)
    setShowExSearch(null)
    setExSearch('')
  }

  const removeExercise = (dayIdx, exIdx) => {
    const updated = [...workoutDays]
    updated[dayIdx].exercises.splice(exIdx, 1)
    setWorkoutDays(updated)
  }

  const handleManualSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const { data: prog } = await supabase
        .from('programs')
        .insert({
          user_id: user.id,
          name,
          description,
          weeks,
          days_per_week: workoutDays.length,
          ai_generated: false,
        })
        .select()
        .single()

      for (let i = 0; i < workoutDays.length; i++) {
        const day = workoutDays[i]
        const { data: wDay } = await supabase
          .from('workout_days')
          .insert({
            program_id: prog.id,
            name: day.name,
            order_index: i,
          })
          .select()
          .single()

        for (let j = 0; j < day.exercises.length; j++) {
          const ex = day.exercises[j]
          await supabase.from('workout_exercises').insert({
            workout_day_id: wDay.id,
            exercise_id: ex.exercise_id,
            order_index: j,
            target_sets: ex.target_sets,
            target_reps: ex.target_reps,
            target_weight: ex.target_weight,
          })
        }
      }

      navigate('/programs', { replace: true })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="screen-container flex items-center justify-center">
        <LoadingSpinner message={mode === 'ai' ? 'AI is building your program...' : 'Saving program...'} />
      </div>
    )
  }

  // Mode selection
  if (!mode) {
    return (
      <div className="screen-container px-4 pt-4">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => navigate('/programs')} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-border">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">Create Program</h1>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setMode('manual')}
            className="w-full bg-white rounded-xl p-5 text-left border-2 border-border"
          >
            <p className="font-semibold text-slate-800 mb-1">Manual Program</p>
            <p className="text-sm text-muted">Build your own program from scratch</p>
          </button>

          <button
            onClick={() => { setMode('ai'); handleAiGenerate() }}
            className="w-full bg-gradient-to-r from-primary to-purple-500 rounded-xl p-5 text-left text-white"
          >
            <div className="flex items-center gap-2 mb-1">
              <Zap size={18} />
              <p className="font-semibold">AI Generate</p>
            </div>
            <p className="text-sm text-white/80">Let Claude build a program based on your profile</p>
          </button>
        </div>
      </div>
    )
  }

  // Manual creation
  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(exSearch.toLowerCase())
  )

  return (
    <div className="screen-container px-4 pt-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setMode(null)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-border">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Manual Program</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Program Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="e.g. Push Pull Legs"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-20 px-4 py-3 rounded-xl border border-border bg-white text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Optional description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Duration (weeks)</label>
          <input
            type="number"
            inputMode="numeric"
            value={weeks}
            onChange={(e) => setWeeks(parseInt(e.target.value) || 1)}
            className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Workout Days */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Workout Days</label>
            <button onClick={addDay} className="text-sm text-primary font-medium flex items-center gap-1">
              <Plus size={14} /> Add Day
            </button>
          </div>

          {workoutDays.map((day, dayIdx) => (
            <div key={dayIdx} className="bg-white rounded-xl p-3 mb-2 border border-border">
              <input
                value={day.name}
                onChange={(e) => {
                  const updated = [...workoutDays]
                  updated[dayIdx].name = e.target.value
                  setWorkoutDays(updated)
                }}
                className="w-full h-10 px-3 rounded-lg border border-border text-sm font-medium mb-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />

              {day.exercises.map((ex, exIdx) => (
                <div key={exIdx} className="flex items-center gap-2 py-1.5 border-t border-border/50">
                  <span className="text-sm text-slate-700 flex-1">{ex.exercise_name}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={ex.target_sets}
                    onChange={(e) => {
                      const updated = [...workoutDays]
                      updated[dayIdx].exercises[exIdx].target_sets = parseInt(e.target.value) || 0
                      setWorkoutDays(updated)
                    }}
                    className="w-12 h-8 text-center rounded border border-border text-sm focus:outline-none"
                    placeholder="Sets"
                  />
                  <span className="text-xs text-muted">×</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={ex.target_reps}
                    onChange={(e) => {
                      const updated = [...workoutDays]
                      updated[dayIdx].exercises[exIdx].target_reps = parseInt(e.target.value) || 0
                      setWorkoutDays(updated)
                    }}
                    className="w-12 h-8 text-center rounded border border-border text-sm focus:outline-none"
                    placeholder="Reps"
                  />
                  <button onClick={() => removeExercise(dayIdx, exIdx)} className="text-muted">
                    <X size={16} />
                  </button>
                </div>
              ))}

              <button
                onClick={() => setShowExSearch(dayIdx)}
                className="mt-2 text-sm text-primary font-medium flex items-center gap-1"
              >
                <Plus size={14} /> Add Exercise
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={handleManualSave}
          disabled={!name.trim() || workoutDays.length === 0}
          className="w-full h-12 bg-primary text-white font-semibold rounded-xl disabled:opacity-40"
        >
          Save Program
        </button>
      </div>

      {/* Exercise Search Modal */}
      {showExSearch !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full max-w-[480px] mx-auto bg-white rounded-t-2xl max-h-[70vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Search size={18} className="text-muted" />
              <input
                value={exSearch}
                onChange={(e) => setExSearch(e.target.value)}
                className="flex-1 text-base focus:outline-none"
                placeholder="Search exercises..."
                autoFocus
              />
              <button onClick={() => { setShowExSearch(null); setExSearch('') }} className="text-muted">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {filteredExercises.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => addExerciseToDay(showExSearch, ex)}
                  className="w-full text-left px-3 py-3 rounded-lg hover:bg-surface active:bg-surface transition-colors"
                >
                  <p className="text-sm font-medium text-slate-800">{ex.name}</p>
                  <p className="text-xs text-muted">{ex.muscle_group}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
