import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchPrograms, fetchProgramDetail } from '../lib/programService'
import { fetchWeekSessions } from '../lib/sessionService'
import { generateProgram, generateWeeklyAdaptation, detectPlateaus } from '../lib/ai'
import { saveProgramToDb } from '../lib/programService'
import { Zap, Check, X, RefreshCw, AlertTriangle, TrendingUp, Settings } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import SkeletonCard from '../components/SkeletonCard'

export default function CoachScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genMessage, setGenMessage] = useState('')
  const [programs, setPrograms] = useState([])
  const [rationale, setRationale] = useState('')
  const [adaptations, setAdaptations] = useState([])
  const [plateauAlerts, setPlateauAlerts] = useState([])
  const [weekSummary, setWeekSummary] = useState('')
  const [profile, setProfile] = useState(null)
  const [regenReason, setRegenReason] = useState('')
  const [showRegen, setShowRegen] = useState(false)
  const [goalSummary, setGoalSummary] = useState('')

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const [progs, { data: prof }, { data: adapts }] = await Promise.all([
        fetchPrograms(user.id),
        supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('adaptations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      ])

      setPrograms(progs)
      setProfile(prof)
      setAdaptations(adapts || [])

      if (prof) {
        const goalLabels = { fat_loss: 'Fat Loss', muscle_gain: 'Muscle Gain', strength: 'Strength', endurance: 'Endurance', general: 'General Fitness' }
        setGoalSummary(`${goalLabels[prof.goal] || prof.goal} · ${prof.experience} · ${prof.days_per_week} days/week`)
      }

      if (progs.length > 0) {
        const desc = progs[0].description || ''
        const rat = desc.split('\n\nRationale: ')[1]
        setRationale(rat || '')
      }

      // Check for plateaus
      await checkPlateaus()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function checkPlateaus() {
    try {
      const { data: sets } = await supabase
        .from('session_sets')
        .select(`
          *,
          exercises (name),
          sessions!inner (user_id, finished_at, started_at)
        `)
        .eq('sessions.user_id', user.id)
        .eq('completed', true)
        .not('sessions.finished_at', 'is', null)
        .order('sessions(started_at)', { ascending: false })
        .limit(200)

      if (!sets) return

      // Group by exercise
      const byExercise = {}
      sets.forEach(s => {
        const name = s.exercises?.name
        if (!name) return
        if (!byExercise[name]) byExercise[name] = []
        byExercise[name].push(s)
      })

      const alerts = []
      for (const [name, exSets] of Object.entries(byExercise)) {
        // Group by session date
        const bySesh = {}
        exSets.forEach(s => {
          const date = new Date(s.sessions?.started_at).toDateString()
          if (!bySesh[date]) bySesh[date] = { maxWeight: 0, maxReps: 0 }
          if (s.weight > bySesh[date].maxWeight) bySesh[date].maxWeight = s.weight
          if (s.reps > bySesh[date].maxReps) bySesh[date].maxReps = s.reps
        })

        const sessions = Object.values(bySesh)
        if (sessions.length >= 3) {
          const recentWeight = sessions.slice(0, 3).map(s => s.maxWeight)
          const allSame = recentWeight.every(w => w === recentWeight[0])
          const recentReps = sessions.slice(0, 3).map(s => s.maxReps)
          const noRepIncrease = recentReps.every(r => r <= recentReps[recentReps.length - 1])
          if (allSame && noRepIncrease && recentWeight[0] > 0) {
            alerts.push({ exercise: name, weight: recentWeight[0], sessions: 3, reps: recentReps })
          }
        }
      }
      setPlateauAlerts(alerts)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleWeeklyAdaptation() {
    setGenerating(true)
    setGenMessage('Analyzing your week...')
    try {
      const weekData = await fetchWeekSessions(user.id)
      const result = await generateWeeklyAdaptation(profile, weekData)

      if (result.adaptations) {
        for (const adapt of result.adaptations) {
          await supabase.from('adaptations').insert({
            user_id: user.id,
            program_id: programs[0]?.id,
            suggestion: `[${adapt.type}] ${adapt.exercise_name}: ${adapt.suggestion}`,
          })
        }
      }
      setWeekSummary(result.week_summary || '')
      await loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
      setGenMessage('')
    }
  }

  async function handleRegenerate() {
    if (!profile) { navigate('/onboarding'); return }
    setGenerating(true)
    setGenMessage('Regenerating your program...')
    try {
      const result = await generateProgram(profile)
      await saveProgramToDb(user.id, result.program)
      setShowRegen(false)
      setRegenReason('')
      await loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
      setGenMessage('')
    }
  }

  async function handleAcceptAdaptation(id) {
    await supabase.from('adaptations').update({ accepted: true }).eq('id', id)
    setAdaptations(prev => prev.map(a => a.id === id ? { ...a, accepted: true } : a))
  }

  async function handleDismissAdaptation(id) {
    await supabase.from('adaptations').update({ accepted: false }).eq('id', id)
    setAdaptations(prev => prev.map(a => a.id === id ? { ...a, accepted: false } : a))
  }

  async function handlePlateauAction(alert) {
    setGenerating(true)
    setGenMessage(`Analyzing ${alert.exercise}...`)
    try {
      const result = await detectPlateaus(alert.exercise, alert.weight, alert.sessions, alert.reps)
      await supabase.from('adaptations').insert({
        user_id: user.id,
        program_id: programs[0]?.id,
        suggestion: `[plateau] ${alert.exercise}: ${result.plateau_suggestion}${result.alternative_exercise ? ` (Try: ${result.alternative_exercise})` : ''}`,
      })
      await loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
      setGenMessage('')
    }
  }

  if (loading) {
    return (
      <div className="screen-container px-4 pt-6 space-y-3">
        <SkeletonCard lines={4} /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (generating) {
    return (
      <div className="screen-container flex items-center justify-center">
        <div className="text-center">
          <Zap size={40} className="text-primary mx-auto mb-4" />
          <LoadingSpinner message={genMessage} />
        </div>
      </div>
    )
  }

  const pendingAdaptations = adaptations.filter(a => a.accepted === null)

  return (
    <div className="screen-container px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">AI Coach</h1>
        <button
          onClick={() => navigate('/profile')}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-border"
        >
          <Settings size={18} className="text-muted" />
        </button>
      </div>

      {/* Goal summary */}
      {goalSummary && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
          <TrendingUp size={18} className="text-primary" />
          <div>
            <p className="text-xs font-semibold text-primary">Your Goal</p>
            <p className="text-sm text-slate-700">{goalSummary}</p>
          </div>
        </div>
      )}

      {/* Program Rationale */}
      {rationale && (
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-primary" />
            <p className="text-sm font-semibold text-slate-700">Program Rationale</p>
          </div>
          <p className="text-sm text-slate-600">{rationale}</p>
        </div>
      )}

      {/* Weekly Check-in */}
      <div className="bg-white rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700">Weekly Check-in</p>
          <button
            onClick={handleWeeklyAdaptation}
            className="text-xs text-primary font-medium flex items-center gap-1"
          >
            <RefreshCw size={12} /> Analyze Week
          </button>
        </div>

        {weekSummary && (
          <p className="text-sm text-slate-600 bg-surface rounded-lg p-3 mb-3">{weekSummary}</p>
        )}

        {pendingAdaptations.length === 0 ? (
          <p className="text-sm text-muted">No pending suggestions. Run a weekly analysis to get AI coaching feedback.</p>
        ) : (
          <div className="space-y-2">
            {pendingAdaptations.map(a => (
              <div key={a.id} className="bg-surface rounded-lg p-3 flex items-start gap-2">
                <div className="flex-1">
                  <p className="text-sm text-slate-700">{a.suggestion}</p>
                  <p className="text-xs text-muted mt-1">
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleAcceptAdaptation(a.id)}
                    className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center text-success"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => handleDismissAdaptation(a.id)}
                    className="w-8 h-8 bg-danger/10 rounded-lg flex items-center justify-center text-danger"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plateau Alerts */}
      {plateauAlerts.length > 0 && (
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-warning" />
            <p className="text-sm font-semibold text-slate-700">Plateau Alerts</p>
          </div>
          <div className="space-y-2">
            {plateauAlerts.map((alert, i) => (
              <div key={i} className="bg-warning/5 border border-warning/20 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">{alert.exercise}</p>
                <p className="text-xs text-muted mb-2">
                  Stuck at {alert.weight}lbs for {alert.sessions}+ sessions
                </p>
                <button
                  onClick={() => handlePlateauAction(alert)}
                  className="text-xs text-primary font-medium flex items-center gap-1"
                >
                  <Zap size={12} /> Get AI Suggestion
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regenerate Program */}
      <div className="bg-white rounded-xl p-4">
        <button
          onClick={() => setShowRegen(!showRegen)}
          className="flex items-center gap-2 w-full"
        >
          <RefreshCw size={16} className="text-primary" />
          <p className="text-sm font-semibold text-slate-700">Regenerate My Program</p>
        </button>

        {showRegen && (
          <div className="mt-3 space-y-3">
            <textarea
              value={regenReason}
              onChange={(e) => setRegenReason(e.target.value)}
              className="w-full h-20 px-3 py-2 rounded-xl border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Optional: reason for regenerating (e.g. 'want more upper body focus')"
            />
            <button
              onClick={handleRegenerate}
              className="w-full h-11 bg-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm"
            >
              <Zap size={16} /> Generate New Program
            </button>
          </div>
        )}
      </div>

      {/* Edit Profile Link */}
      <button
        onClick={() => navigate('/profile')}
        className="w-full text-sm text-primary font-medium py-2"
      >
        Edit Fitness Profile →
      </button>
    </div>
  )
}
