import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateProgram } from '../lib/ai'
import { saveProgramToDb } from '../lib/programService'
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

const GOALS = [
  { value: 'fat_loss', label: 'Lose Fat', emoji: '🔥' },
  { value: 'muscle_gain', label: 'Build Muscle', emoji: '💪' },
  { value: 'strength', label: 'Gain Strength', emoji: '🏋️' },
  { value: 'endurance', label: 'Improve Endurance', emoji: '🏃' },
  { value: 'general', label: 'General Fitness', emoji: '⭐' },
]

const EXPERIENCE = [
  { value: 'beginner', label: 'Beginner', desc: 'Less than 1 year' },
  { value: 'intermediate', label: 'Intermediate', desc: '1-3 years' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years' },
]

const DAYS = [2, 3, 4, 5, 6]

const EQUIPMENT = [
  { value: 'full_gym', label: 'Full Gym' },
  { value: 'home_gym', label: 'Home Gym' },
  { value: 'dumbbells', label: 'Dumbbells Only' },
  { value: 'bodyweight', label: 'Bodyweight Only' },
]

const LIMITATIONS = ['Lower Back', 'Knees', 'Shoulders', 'None']

export default function OnboardingScreen({ onComplete }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [profile, setProfile] = useState({
    goal: '',
    experience: '',
    days_per_week: 4,
    equipment: '',
    limitations: [],
    squat_1rm: '',
    bench_1rm: '',
    deadlift_1rm: '',
  })

  const update = (key, value) => setProfile((p) => ({ ...p, [key]: value }))

  const toggleLimitation = (lim) => {
    if (lim === 'None') {
      update('limitations', [])
      return
    }
    setProfile((p) => {
      const has = p.limitations.includes(lim)
      return { ...p, limitations: has ? p.limitations.filter((l) => l !== lim) : [...p.limitations, lim] }
    })
  }

  const canNext = () => {
    if (step === 0) return profile.goal
    if (step === 1) return profile.experience
    if (step === 2) return profile.days_per_week
    if (step === 3) return profile.equipment
    return true
  }

  const handleFinish = async () => {
    setGenerating(true)
    try {
      const dbProfile = {
        user_id: user.id,
        goal: profile.goal,
        experience: profile.experience,
        days_per_week: profile.days_per_week,
        equipment: profile.equipment,
        limitations: profile.limitations.length > 0 ? profile.limitations : null,
        squat_1rm: profile.squat_1rm ? parseFloat(profile.squat_1rm) : null,
        bench_1rm: profile.bench_1rm ? parseFloat(profile.bench_1rm) : null,
        deadlift_1rm: profile.deadlift_1rm ? parseFloat(profile.deadlift_1rm) : null,
      }

      await supabase.from('user_profiles').upsert(dbProfile, { onConflict: 'user_id' })

      // Profile saved — tell the app so it won't loop back to onboarding
      onComplete?.()

      try {
        const result = await generateProgram(dbProfile)
        await saveProgramToDb(user.id, result.program)
      } catch (aiErr) {
        console.error('AI program generation failed:', aiErr)
        // Profile is saved, user can generate a program later from the AI Coach tab
      }

      navigate('/home', { replace: true })
    } catch (err) {
      console.error('Onboarding error:', err)
      onComplete?.()
      navigate('/home', { replace: true })
    } finally {
      setGenerating(false)
    }
  }

  if (generating) {
    return (
      <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-6">
        <Zap size={40} className="text-primary mb-4" />
        <LoadingSpinner message="Building your personalized program..." />
        <p className="text-xs text-muted mt-2">This may take a few seconds</p>
      </div>
    )
  }

  const steps = [
    // Step 0: Goal
    <div key="goal" className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-text-secondary">Step 1 of 6</p>
      <h2 className="text-xl font-bold text-text">What's your main goal?</h2>
      <p className="text-sm text-muted">This helps us design the right program</p>
      <div className="space-y-2 mt-4">
        {GOALS.map((g) => (
          <button
            key={g.value}
            onClick={() => update('goal', g.value)}
            className={`w-full h-14 rounded-xl border text-left px-4 flex items-center gap-3 font-medium transition-colors ${
              profile.goal === g.value
                ? 'border-primary bg-primary-dim text-primary'
                : 'border-border bg-card text-text'
            }`}
          >
            <span className="text-xl">{g.emoji}</span>
            {g.label}
          </button>
        ))}
      </div>
    </div>,

    // Step 1: Experience
    <div key="exp" className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-text-secondary">Step 2 of 6</p>
      <h2 className="text-xl font-bold text-text">Experience level?</h2>
      <p className="text-sm text-muted">We'll adjust intensity accordingly</p>
      <div className="space-y-2 mt-4">
        {EXPERIENCE.map((e) => (
          <button
            key={e.value}
            onClick={() => update('experience', e.value)}
            className={`w-full h-14 rounded-xl border text-left px-4 flex items-center justify-between font-medium transition-colors ${
              profile.experience === e.value
                ? 'border-primary bg-primary-dim text-primary'
                : 'border-border bg-card text-text'
            }`}
          >
            <span>{e.label}</span>
            <span className="text-sm text-muted font-normal">{e.desc}</span>
          </button>
        ))}
      </div>
    </div>,

    // Step 2: Days per week
    <div key="days" className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-text-secondary">Step 3 of 6</p>
      <h2 className="text-xl font-bold text-text">Days per week?</h2>
      <p className="text-sm text-muted">How many days can you train?</p>
      <div className="flex gap-2 mt-4">
        {DAYS.map((d) => (
          <button
            key={d}
            onClick={() => update('days_per_week', d)}
            className={`flex-1 h-14 rounded-xl border font-bold text-lg transition-colors ${
              profile.days_per_week === d
                ? 'border-primary bg-primary-dim text-primary'
                : 'border-border bg-card text-text'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>,

    // Step 3: Equipment
    <div key="equip" className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-text-secondary">Step 4 of 6</p>
      <h2 className="text-xl font-bold text-text">Equipment access?</h2>
      <p className="text-sm text-muted">We'll pick exercises that fit your setup</p>
      <div className="space-y-2 mt-4">
        {EQUIPMENT.map((e) => (
          <button
            key={e.value}
            onClick={() => update('equipment', e.value)}
            className={`w-full h-14 rounded-xl border text-left px-4 font-medium transition-colors ${
              profile.equipment === e.value
                ? 'border-primary bg-primary-dim text-primary'
                : 'border-border bg-card text-text'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>
    </div>,

    // Step 4: Limitations
    <div key="lim" className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-text-secondary">Step 5 of 6</p>
      <h2 className="text-xl font-bold text-text">Any limitations?</h2>
      <p className="text-sm text-muted">Select all that apply</p>
      <div className="space-y-2 mt-4">
        {LIMITATIONS.map((lim) => {
          const selected = lim === 'None' ? profile.limitations.length === 0 : profile.limitations.includes(lim)
          return (
            <button
              key={lim}
              onClick={() => toggleLimitation(lim)}
              className={`w-full h-14 rounded-xl border text-left px-4 font-medium transition-colors ${
                selected
                  ? 'border-primary bg-primary-dim text-primary'
                  : 'border-border bg-card text-text'
              }`}
            >
              {lim}
            </button>
          )
        })}
      </div>
    </div>,

    // Step 5: Baseline lifts
    <div key="lifts" className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-text-secondary">Step 6 of 6</p>
      <h2 className="text-xl font-bold text-text">Baseline lifts</h2>
      <p className="text-sm text-muted">Optional -- skip if you're unsure</p>
      <div className="space-y-3 mt-4">
        {[
          { key: 'squat_1rm', label: 'Squat 1RM (lbs)' },
          { key: 'bench_1rm', label: 'Bench 1RM (lbs)' },
          { key: 'deadlift_1rm', label: 'Deadlift 1RM (lbs)' },
        ].map((f) => (
          <div key={f.key}>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">{f.label}</label>
            <input
              type="number"
              inputMode="decimal"
              value={profile[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-border bg-card text-text text-base focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder-muted"
              placeholder="0"
            />
          </div>
        ))}
      </div>
    </div>,
  ]

  return (
    <div className="min-h-dvh bg-bg flex flex-col px-6 py-8">
      {/* Progress bar */}
      <div className="flex gap-1.5 mb-8">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i <= step ? 'bg-primary' : 'bg-subtle'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1">{steps[step]}</div>

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="h-12 px-4 rounded-xl border border-border bg-card text-text font-medium flex items-center gap-1"
          >
            <ChevronLeft size={18} /> Back
          </button>
        )}
        <button
          onClick={() => (step < 5 ? setStep(step + 1) : handleFinish())}
          disabled={!canNext()}
          className="flex-1 h-12 bg-primary text-bg font-semibold rounded-xl flex items-center justify-center gap-1 disabled:opacity-40 transition-colors"
        >
          {step === 5 ? 'Generate My Program' : (
            <>
              Next <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
