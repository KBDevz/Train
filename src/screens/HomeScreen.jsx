import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUnits } from '../contexts/UnitsContext'
import { useNavigate } from 'react-router-dom'
import { fetchPrograms, fetchProgramDetail, saveProgramToDb } from '../lib/programService'
import { fetchSessions, fetchStreak, fetchWeekSessions } from '../lib/sessionService'
import { generateProgram } from '../lib/ai'
import { supabase } from '../lib/supabase'
import { Zap, Play, ChevronRight, TrendingUp, User } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

const DAYS_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function getCalendarDays() {
  const today = new Date()
  const days = []
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

export default function HomeScreen() {
  const { user } = useAuth()
  const { convertWeight, unitLabel } = useUnits()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState(0)
  const [programs, setPrograms] = useState([])
  const [nextDay, setNextDay] = useState(null)
  const [nextProgram, setNextProgram] = useState(null)
  const [recentSessions, setRecentSessions] = useState([])
  const [weeklyVolume, setWeeklyVolume] = useState([])
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [sessionDates, setSessionDates] = useState(new Set())
  const calendarRef = useRef(null)

  const handleGenerate = async () => {
    setGenerating(true)
    setGenError('')
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!profile) {
        setGenError('No profile found. Please complete onboarding first.')
        return
      }

      const result = await generateProgram(profile)
      await saveProgramToDb(user.id, result.program)
      await loadData()
    } catch (err) {
      console.error('Generate error:', err)
      setGenError(err.message || 'Failed to generate program.')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const [streakVal, progs, sessions, weekData] = await Promise.all([
        fetchStreak(user.id),
        fetchPrograms(user.id),
        fetchSessions(user.id),
        fetchWeekSessions(user.id),
      ])

      setStreak(streakVal)
      setPrograms(progs)
      setRecentSessions(sessions.slice(0, 3))

      // Session dates for calendar dots
      const dates = new Set(sessions.map(s => new Date(s.started_at).toDateString()))
      setSessionDates(dates)

      // Weekly volume
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const volByDay = days.map(() => 0)
      weekData.forEach(session => {
        const d = new Date(session.started_at)
        const dayIdx = (d.getDay() + 6) % 7
        session.session_sets?.forEach(set => {
          if (set.completed && set.weight && set.reps) {
            volByDay[dayIdx] += set.weight * set.reps
          }
        })
      })
      setWeeklyVolume(volByDay.map((v, i) => ({ day: days[i], volume: v })))

      // Next workout
      if (progs.length > 0) {
        const detail = await fetchProgramDetail(progs[0].id)
        const completedDayIds = new Set(sessions.map(s => s.workout_day_id).filter(Boolean))
        const next = detail.days?.find(d => !completedDayIds.has(d.id))
        if (next) {
          setNextDay(next)
          setNextProgram(progs[0])
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const today = new Date()
  const calendarDays = getCalendarDays()
  const maxVol = Math.max(...weeklyVolume.map(w => w.volume), 1)

  if (loading) {
    return (
      <div className="screen-container px-4 pt-4 space-y-3">
        <div className="h-20 bg-card rounded-xl animate-pulse" />
        <div className="h-32 bg-card rounded-xl animate-pulse" />
        <div className="h-40 bg-card rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="screen-container">
      {/* Calendar Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold tracking-tight uppercase text-text">
            {MONTHS[today.getMonth()]} '{String(today.getFullYear()).slice(2)}
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs text-text-secondary">{streak} day streak</span>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center"
            >
              <User size={14} className="text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Calendar Strip */}
        <div ref={calendarRef} className="flex justify-between">
          {calendarDays.map((date) => {
            const isToday = date.toDateString() === today.toDateString()
            const hasSession = sessionDates.has(date.toDateString())
            return (
              <div key={date.toISOString()} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-[10px] uppercase tracking-wider text-muted">
                  {DAYS_LABELS[date.getDay()]}
                </span>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  isToday
                    ? 'bg-primary text-bg'
                    : 'text-text-secondary'
                }`}>
                  {date.getDate()}
                </div>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  hasSession ? 'bg-success' : 'bg-transparent'
                }`} />
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Start Workout CTA */}
        {nextDay ? (
          <button
            onClick={() => navigate('/workout', { state: { day: nextDay, program: nextProgram } })}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 active:bg-card-hover transition-colors"
          >
            <div className="w-11 h-11 bg-primary-dim rounded-xl flex items-center justify-center">
              <Play size={20} className="text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-text text-sm">Today's Workout</p>
              <p className="text-xs text-text-secondary mt-0.5">{nextDay.name} · {nextProgram?.name}</p>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </button>
        ) : programs.length === 0 ? (
          <div>
            {generating ? (
              <div className="bg-card border border-border rounded-xl p-6">
                <LoadingSpinner message="Building your personalized program..." />
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                className="w-full bg-card border border-primary/30 rounded-xl p-4 flex items-center gap-4 active:bg-card-hover transition-colors"
              >
                <div className="w-11 h-11 bg-primary-dim rounded-xl flex items-center justify-center">
                  <Zap size={20} className="text-primary" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-text text-sm">Generate Program</p>
                  <p className="text-xs text-text-secondary mt-0.5">AI-powered, personalized for you</p>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </button>
            )}
            {genError && (
              <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mt-2">{genError}</p>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-success-light rounded-lg flex items-center justify-center">
              <TrendingUp size={18} className="text-success" />
            </div>
            <div>
              <p className="text-sm font-medium text-text">Program Active</p>
              <p className="text-xs text-text-secondary">{programs[0]?.name} · All days completed this cycle</p>
            </div>
          </div>
        )}

        {/* Weekly Volume */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">Weekly Volume</h3>
          <div className="flex items-end gap-1.5 h-20">
            {weeklyVolume.map((w) => (
              <div key={w.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-sm overflow-hidden" style={{ height: '64px' }}>
                  <div className="w-full h-full flex items-end">
                    <div
                      className={`w-full rounded-sm transition-all ${w.volume > 0 ? 'bg-primary' : 'bg-subtle'}`}
                      style={{ height: `${Math.max((w.volume / maxVol) * 64, 3)}px` }}
                    />
                  </div>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-muted">{w.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Sessions */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Recent Sessions</h3>
          {recentSessions.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <p className="text-sm text-muted">No sessions yet</p>
              <p className="text-xs text-muted mt-1">Complete your first workout to track progress</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((s) => {
                const totalVol = s.session_sets?.reduce((sum, set) =>
                  sum + (set.completed && set.weight && set.reps ? set.weight * set.reps : 0), 0) || 0
                const mins = s.duration_seconds ? Math.floor(s.duration_seconds / 60) : null
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate('/history')}
                    className="w-full bg-card border border-border rounded-xl p-3 text-left flex items-center gap-3 active:bg-card-hover transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm text-text">{s.workout_days?.name || 'Workout'}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs text-text-secondary">
                          {new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {mins && <span className="text-xs text-text-secondary">{mins}m</span>}
                        <span className="text-xs text-text-secondary">
                          {convertWeight(totalVol).toLocaleString()} {unitLabel}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
