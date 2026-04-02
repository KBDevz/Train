import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUnits } from '../contexts/UnitsContext'
import { useNavigate } from 'react-router-dom'
import { fetchPrograms, fetchProgramDetail } from '../lib/programService'
import { fetchSessions, fetchStreak, fetchWeekSessions } from '../lib/sessionService'
import { Zap, Flame, Play, ChevronRight } from 'lucide-react'
import SkeletonCard from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'

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

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
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

      // Calculate weekly volume
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const volByDay = days.map(() => 0)
      weekData.forEach(session => {
        const d = new Date(session.started_at)
        const dayIdx = (d.getDay() + 6) % 7 // Monday = 0
        session.session_sets?.forEach(set => {
          if (set.completed && set.weight && set.reps) {
            volByDay[dayIdx] += set.weight * set.reps
          }
        })
      })
      setWeeklyVolume(volByDay.map((v, i) => ({ day: days[i], volume: v })))

      // Find next workout day
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

  const maxVol = Math.max(...weeklyVolume.map(w => w.volume), 1)

  if (loading) {
    return (
      <div className="screen-container px-4 pt-6 space-y-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    )
  }

  return (
    <div className="screen-container px-4 pt-6 space-y-4">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {greeting()} 👋
        </h1>
        <p className="text-sm text-muted">{user?.email}</p>
      </div>

      {/* Streak */}
      <div className="bg-white rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <Flame size={20} className="text-orange-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{streak}</p>
          <p className="text-xs text-muted">Day streak</p>
        </div>
      </div>

      {/* Start Workout CTA */}
      {nextDay ? (
        <button
          onClick={() => navigate('/workout', { state: { day: nextDay, program: nextProgram } })}
          className="w-full bg-primary text-white rounded-xl p-4 flex items-center gap-3 active:bg-primary-dark transition-colors"
        >
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Play size={20} />
          </div>
          <div className="text-left flex-1">
            <p className="font-semibold">Start Today's Workout</p>
            <p className="text-sm text-white/80">{nextDay.name}</p>
          </div>
          <ChevronRight size={20} className="text-white/60" />
        </button>
      ) : programs.length === 0 ? (
        <button
          onClick={() => navigate('/coach')}
          className="w-full bg-gradient-to-r from-primary to-purple-500 text-white rounded-xl p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Zap size={20} />
          </div>
          <div className="text-left flex-1">
            <p className="font-semibold">Generate My Program</p>
            <p className="text-sm text-white/80">AI-powered, personalized for you</p>
          </div>
          <ChevronRight size={20} className="text-white/60" />
        </button>
      ) : null}

      {/* Weekly Volume */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Weekly Volume</h3>
        <div className="flex items-end gap-1.5 h-24">
          {weeklyVolume.map((w) => (
            <div key={w.day} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-primary/20 rounded-t"
                style={{ height: `${Math.max((w.volume / maxVol) * 80, 4)}px` }}
              >
                {w.volume > 0 && (
                  <div
                    className="w-full bg-primary rounded-t transition-all"
                    style={{ height: '100%' }}
                  />
                )}
              </div>
              <span className="text-[10px] text-muted">{w.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sessions */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Recent Sessions</h3>
        {recentSessions.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No sessions yet. Start your first workout!</p>
        ) : (
          <div className="space-y-2">
            {recentSessions.map((s) => {
              const totalVol = s.session_sets?.reduce((sum, set) =>
                sum + (set.completed && set.weight && set.reps ? set.weight * set.reps : 0), 0) || 0
              return (
                <button
                  key={s.id}
                  onClick={() => navigate('/history')}
                  className="w-full bg-white rounded-xl p-3 text-left flex items-center gap-3"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm text-slate-800">{s.workout_days?.name || 'Workout'}</p>
                    <p className="text-xs text-muted">
                      {new Date(s.started_at).toLocaleDateString()} · {convertWeight(totalVol).toLocaleString()} {unitLabel}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-muted" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
