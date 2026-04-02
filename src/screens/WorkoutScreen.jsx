import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUnits } from '../contexts/UnitsContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { startSession, finishSession, saveSessionSets, fetchLastSessionSets } from '../lib/sessionService'
import { fetchExerciseLibrary } from '../lib/programService'
import { supabase } from '../lib/supabase'
import { Check, Plus, Search, X, ChevronDown, ChevronUp, Square } from 'lucide-react'

const CACHE_KEY = 'trainlocal_active_session'

export default function WorkoutScreen() {
  const { user } = useAuth()
  const { convertWeight, convertToLbs, unitLabel } = useUnits()
  const location = useLocation()
  const navigate = useNavigate()
  const { day, program } = location.state || {}

  const [sessionId, setSessionId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [exerciseCards, setExerciseCards] = useState([])
  const [showFinish, setShowFinish] = useState(false)
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [showExSearch, setShowExSearch] = useState(false)
  const [exSearch, setExSearch] = useState('')
  const [exercises, setExercises] = useState([])
  const [collapsedNotes, setCollapsedNotes] = useState({})
  const timerRef = useRef(null)
  const startTimeRef = useRef(null)

  // Load exercise library
  useEffect(() => {
    if (user) fetchExerciseLibrary(user.id).then(setExercises).catch(console.error)
  }, [user])

  // Initialize session
  useEffect(() => {
    if (!user) return

    // Try to restore cached session
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setSessionId(parsed.sessionId)
        setExerciseCards(parsed.exerciseCards)
        startTimeRef.current = new Date(parsed.startTime)
        return
      } catch (e) {
        localStorage.removeItem(CACHE_KEY)
      }
    }

    // Start new session
    initSession()
  }, [user])

  async function initSession() {
    try {
      const sess = await startSession(user.id, day?.id, program?.id)
      setSessionId(sess.id)
      startTimeRef.current = new Date()

      // Pre-fill from workout day
      if (day?.workout_exercises) {
        const cards = await Promise.all(
          day.workout_exercises.map(async (we) => {
            const lastSets = await fetchLastSessionSets(user.id, we.exercise_id).catch(() => [])
            const sets = Array.from({ length: we.target_sets }, (_, i) => ({
              set_number: i + 1,
              weight: '',
              reps: '',
              completed: false,
              lastWeight: lastSets[i]?.weight || we.target_weight,
              lastReps: lastSets[i]?.reps || we.target_reps,
            }))
            const lastSummary = lastSets
              .filter(s => s.completed)
              .map(s => `${s.weight}×${s.reps}`)
              .join(', ')
            return {
              exercise_id: we.exercise_id,
              exercise_name: we.exercises?.name || 'Exercise',
              sets,
              notes: we.notes || '',
              lastSummary,
            }
          })
        )
        setExerciseCards(cards)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000))
      }
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  // Cache to localStorage on every change
  useEffect(() => {
    if (sessionId && exerciseCards.length > 0) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        sessionId,
        exerciseCards,
        startTime: startTimeRef.current?.toISOString(),
      }))
    }
  }, [exerciseCards, sessionId])

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const totalVolume = exerciseCards.reduce((sum, card) =>
    sum + card.sets.reduce((s, set) =>
      s + (set.completed && set.weight && set.reps ? parseFloat(set.weight) * parseInt(set.reps) : 0), 0), 0)

  const totalSetsCompleted = exerciseCards.reduce((sum, card) =>
    sum + card.sets.filter(s => s.completed).length, 0)

  const updateSet = useCallback((cardIdx, setIdx, field, value) => {
    setExerciseCards(prev => {
      const updated = [...prev]
      updated[cardIdx] = { ...updated[cardIdx], sets: [...updated[cardIdx].sets] }
      updated[cardIdx].sets[setIdx] = { ...updated[cardIdx].sets[setIdx], [field]: value }
      return updated
    })
  }, [])

  const toggleComplete = useCallback((cardIdx, setIdx) => {
    setExerciseCards(prev => {
      const updated = [...prev]
      updated[cardIdx] = { ...updated[cardIdx], sets: [...updated[cardIdx].sets] }
      const set = { ...updated[cardIdx].sets[setIdx] }
      set.completed = !set.completed
      // Auto-fill from placeholders if completing
      if (set.completed) {
        if (!set.weight && set.lastWeight) set.weight = String(set.lastWeight)
        if (!set.reps && set.lastReps) set.reps = String(set.lastReps)
      }
      updated[cardIdx].sets[setIdx] = set
      return updated
    })
  }, [])

  const addSet = (cardIdx) => {
    setExerciseCards(prev => {
      const updated = [...prev]
      updated[cardIdx] = { ...updated[cardIdx], sets: [...updated[cardIdx].sets] }
      const lastSet = updated[cardIdx].sets[updated[cardIdx].sets.length - 1]
      updated[cardIdx].sets.push({
        set_number: updated[cardIdx].sets.length + 1,
        weight: '',
        reps: '',
        completed: false,
        lastWeight: lastSet?.lastWeight || '',
        lastReps: lastSet?.lastReps || '',
      })
      return updated
    })
  }

  const addExercise = (exercise) => {
    setExerciseCards(prev => [...prev, {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      sets: [{ set_number: 1, weight: '', reps: '', completed: false, lastWeight: '', lastReps: '' }],
      notes: '',
      lastSummary: '',
    }])
    setShowExSearch(false)
    setExSearch('')
  }

  const handleFinish = async () => {
    try {
      const allSets = exerciseCards.flatMap(card =>
        card.sets.map(set => ({
          exercise_id: card.exercise_id,
          set_number: set.set_number,
          weight: set.weight ? parseFloat(set.weight) : null,
          reps: set.reps ? parseInt(set.reps) : null,
          completed: set.completed,
          rpe: null,
        }))
      )

      await saveSessionSets(sessionId, allSets)
      await finishSession(sessionId, elapsed, feedbackRating || null, null)

      localStorage.removeItem(CACHE_KEY)
      navigate('/home', { replace: true })
    } catch (err) {
      console.error(err)
    }
  }

  const feedbackEmojis = [
    { emoji: '😴', label: 'Exhausted', value: 1 },
    { emoji: '🙂', label: 'Good', value: 2 },
    { emoji: '💪', label: 'Strong', value: 3 },
    { emoji: '🔥', label: 'Fired Up', value: 4 },
  ]

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      {/* Header */}
      <div className="bg-white border-b border-border px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800 text-sm">{day?.name || 'Workout'}</p>
            <div className="flex gap-3 mt-0.5">
              <span className="text-xs text-muted">⏱ {formatTime(elapsed)}</span>
              <span className="text-xs text-muted">📊 {convertWeight(totalVolume).toLocaleString()} {unitLabel}</span>
            </div>
          </div>
          <button
            onClick={() => setShowFinish(true)}
            className="h-9 px-4 bg-success text-white text-sm font-semibold rounded-lg"
          >
            Finish
          </button>
        </div>
      </div>

      {/* Exercise Cards */}
      <div className="flex-1 px-4 py-4 space-y-4 pb-24">
        {exerciseCards.map((card, cardIdx) => (
          <div key={cardIdx} className="bg-white rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50">
              <p className="font-semibold text-slate-800">{card.exercise_name}</p>
              {card.lastSummary && (
                <p className="text-xs text-muted mt-0.5">Last time: {card.lastSummary}</p>
              )}
            </div>

            <div className="px-4 py-2">
              {/* Header row */}
              <div className="flex items-center gap-2 py-1 text-xs text-muted font-medium">
                <span className="w-8 text-center">Set</span>
                <span className="flex-1 text-center">{unitLabel}</span>
                <span className="flex-1 text-center">Reps</span>
                <span className="w-10 text-center">✓</span>
              </div>

              {card.sets.map((set, setIdx) => (
                <div
                  key={setIdx}
                  className={`flex items-center gap-2 py-1.5 rounded-lg transition-colors ${
                    set.completed ? 'bg-success-light' : ''
                  }`}
                >
                  <span className="w-8 text-center text-sm font-medium text-slate-500">{set.set_number}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={set.weight}
                    onChange={(e) => updateSet(cardIdx, setIdx, 'weight', e.target.value)}
                    placeholder={set.lastWeight ? String(convertWeight(set.lastWeight)) : '0'}
                    className="flex-1 h-11 text-center rounded-lg border border-border bg-surface text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-slate-300"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={set.reps}
                    onChange={(e) => updateSet(cardIdx, setIdx, 'reps', e.target.value)}
                    placeholder={set.lastReps ? String(set.lastReps) : '0'}
                    className="flex-1 h-11 text-center rounded-lg border border-border bg-surface text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-slate-300"
                  />
                  <button
                    onClick={() => toggleComplete(cardIdx, setIdx)}
                    className={`w-10 h-11 rounded-lg flex items-center justify-center transition-colors ${
                      set.completed
                        ? 'bg-success text-white'
                        : 'border border-border text-muted'
                    }`}
                  >
                    {set.completed ? <Check size={18} /> : <Square size={16} />}
                  </button>
                </div>
              ))}

              <button
                onClick={() => addSet(cardIdx)}
                className="w-full py-2 text-sm text-primary font-medium flex items-center justify-center gap-1 mt-1"
              >
                <Plus size={14} /> Add Set
              </button>
            </div>

            {/* Notes */}
            <div className="px-4 pb-3">
              <button
                onClick={() => setCollapsedNotes(p => ({ ...p, [cardIdx]: !p[cardIdx] }))}
                className="text-xs text-muted flex items-center gap-1"
              >
                Notes {collapsedNotes[cardIdx] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {collapsedNotes[cardIdx] && (
                <textarea
                  value={card.notes}
                  onChange={(e) => {
                    const updated = [...exerciseCards]
                    updated[cardIdx].notes = e.target.value
                    setExerciseCards(updated)
                  }}
                  className="w-full h-16 mt-1 px-3 py-2 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Add notes..."
                />
              )}
            </div>
          </div>
        ))}

        <button
          onClick={() => setShowExSearch(true)}
          className="w-full h-12 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Add Exercise
        </button>
      </div>

      {/* Finish Modal */}
      {showFinish && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Workout Complete!</h2>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="text-center">
                <p className="text-xl font-bold text-slate-800">{formatTime(elapsed)}</p>
                <p className="text-xs text-muted">Duration</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-800">{convertWeight(totalVolume).toLocaleString()}</p>
                <p className="text-xs text-muted">{unitLabel}</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-800">{totalSetsCompleted}</p>
                <p className="text-xs text-muted">Sets</p>
              </div>
            </div>

            <p className="text-sm font-medium text-slate-700 mb-2">How was it?</p>
            <div className="flex gap-3 mb-5">
              {feedbackEmojis.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFeedbackRating(f.value)}
                  className={`flex-1 py-3 rounded-xl text-center text-xl transition-colors ${
                    feedbackRating === f.value ? 'bg-primary/10 ring-2 ring-primary' : 'bg-surface'
                  }`}
                >
                  {f.emoji}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowFinish(false)}
                className="flex-1 h-12 rounded-xl border border-border font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 h-12 bg-primary text-white rounded-xl font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Search Sheet */}
      {showExSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full max-w-[480px] mx-auto bg-white rounded-t-2xl max-h-[70vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Search size={18} className="text-muted" />
              <input
                value={exSearch}
                onChange={(e) => setExSearch(e.target.value)}
                className="flex-1 text-base focus:outline-none"
                placeholder="Search exercises or type to create..."
                autoFocus
              />
              <button onClick={() => { setShowExSearch(false); setExSearch('') }} className="text-muted">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {exercises.filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase())).map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => addExercise(ex)}
                  className="w-full text-left px-3 py-3 rounded-lg active:bg-surface transition-colors"
                >
                  <p className="text-sm font-medium text-slate-800">{ex.name}</p>
                  <p className="text-xs text-muted">{ex.muscle_group}</p>
                </button>
              ))}
              {exSearch && !exercises.some(e => e.name.toLowerCase() === exSearch.toLowerCase()) && (
                <button
                  onClick={async () => {
                    const { data } = await supabase
                      .from('exercises')
                      .insert({ user_id: user.id, name: exSearch, muscle_group: 'Other', movement_type: 'other' })
                      .select()
                      .single()
                    if (data) addExercise(data)
                  }}
                  className="w-full text-left px-3 py-3 rounded-lg bg-primary/5"
                >
                  <p className="text-sm font-medium text-primary">+ Create "{exSearch}"</p>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
