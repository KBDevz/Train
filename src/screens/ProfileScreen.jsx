import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUnits } from '../contexts/UnitsContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateProgram } from '../lib/ai'
import { saveProgramToDb } from '../lib/programService'
import { ChevronLeft, LogOut } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

const GOALS = [
  { value: 'fat_loss', label: 'Lose Fat' },
  { value: 'muscle_gain', label: 'Build Muscle' },
  { value: 'strength', label: 'Gain Strength' },
  { value: 'endurance', label: 'Improve Endurance' },
  { value: 'general', label: 'General Fitness' },
]
const EXPERIENCE = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]
const EQUIPMENT = [
  { value: 'full_gym', label: 'Full Gym' },
  { value: 'home_gym', label: 'Home Gym' },
  { value: 'dumbbells', label: 'Dumbbells Only' },
  { value: 'bodyweight', label: 'Bodyweight Only' },
]
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]
const TRAINING_TIMES = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'no_preference', label: 'No preference' },
]
const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Glutes']

export default function ProfileScreen() {
  const { user, signOut } = useAuth()
  const { units, setUnits } = useUnits()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [originalGoal, setOriginalGoal] = useState('')

  useEffect(() => {
    if (!user) return
    supabase.from('user_profiles').select('*').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          setOriginalGoal(data.goal)
        }
      })
      .finally(() => setLoading(false))
  }, [user])

  const update = (key, value) => setProfile(p => ({ ...p, [key]: value }))

  const handleSave = async () => {
    if (!profile) return

    const goalChanged = profile.goal !== originalGoal
    if (goalChanged) {
      if (!confirm('Updating your goal will regenerate your program. Continue?')) {
        update('goal', originalGoal)
        return
      }
    }

    setSaving(true)
    try {
      await supabase.from('user_profiles').upsert({
        ...profile,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      if (goalChanged) {
        const result = await generateProgram(profile)
        await saveProgramToDb(user.id, result.program)
      }

      setOriginalGoal(profile.goal)
      navigate(-1)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="screen-container flex items-center justify-center"><LoadingSpinner /></div>
  }

  if (saving) {
    return (
      <div className="screen-container flex items-center justify-center">
        <LoadingSpinner message="Saving profile..." />
      </div>
    )
  }

  return (
    <div className="screen-container px-4 pt-4">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-card border border-border">
          <ChevronLeft size={20} className="text-text" />
        </button>
        <h1 className="text-lg font-bold text-text">Profile</h1>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <p className="text-sm font-medium text-text">{profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : user?.email}</p>
        <p className="text-xs text-muted mt-1">{profile?.first_name ? user?.email : 'Account'}</p>
      </div>

      {/* Units */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <p className="text-xs uppercase tracking-wider text-text-secondary mb-2">Weight Units</p>
        <div className="flex gap-2">
          {['lbs', 'kg'].map(u => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`flex-1 h-10 rounded-lg font-medium text-sm transition-colors ${
                units === u ? 'border border-primary bg-primary-dim text-primary' : 'bg-card border border-border text-text-secondary'
              }`}
            >
              {u.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Fitness Profile */}
      {profile && (
        <div className="space-y-4 mb-6">
          <h2 className="text-xs uppercase tracking-wider text-text-secondary">Personal Info</h2>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">First Name</label>
              <input
                type="text"
                value={profile.first_name || ''}
                onChange={(e) => update('first_name', e.target.value || null)}
                className="w-full h-10 px-3 rounded-lg bg-card border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="First"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">Last Name</label>
              <input
                type="text"
                value={profile.last_name || ''}
                onChange={(e) => update('last_name', e.target.value || null)}
                className="w-full h-10 px-3 rounded-lg bg-card border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Last"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">Age</label>
              <input
                type="number"
                inputMode="numeric"
                value={profile.age || ''}
                onChange={(e) => update('age', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full h-10 px-3 rounded-lg bg-card border border-border text-text text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="—"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">Height</label>
              <input
                type="text"
                value={profile.height_inches ? `${Math.floor(profile.height_inches / 12)}'${profile.height_inches % 12}"` : ''}
                onChange={(e) => {
                  const match = e.target.value.match(/(\d+)'?\s*(\d*)/)
                  if (match) update('height_inches', parseInt(match[1]) * 12 + (parseInt(match[2]) || 0))
                }}
                className="w-full h-10 px-3 rounded-lg bg-card border border-border text-text text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={`5'10"`}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">Weight</label>
              <input
                type="number"
                inputMode="decimal"
                value={profile.weight_lbs || ''}
                onChange={(e) => update('weight_lbs', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full h-10 px-3 rounded-lg bg-card border border-border text-text text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="lbs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">Gender</label>
            <div className="flex gap-2 flex-wrap">
              {GENDERS.map(g => (
                <button
                  key={g.value}
                  onClick={() => update('gender', g.value)}
                  className={`h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                    profile.gender === g.value ? 'border border-primary bg-primary-dim text-primary' : 'bg-card border border-border text-text-secondary'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <h2 className="text-xs uppercase tracking-wider text-text-secondary pt-2">Fitness Profile</h2>

          <div>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">Goal</label>
            <div className="space-y-1.5">
              {GOALS.map(g => (
                <button
                  key={g.value}
                  onClick={() => update('goal', g.value)}
                  className={`w-full h-11 rounded-xl border text-left px-4 text-sm font-medium transition-colors ${
                    profile.goal === g.value ? 'border-primary bg-primary-dim text-primary' : 'border-border bg-card text-text-secondary'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">Experience</label>
            <div className="flex gap-2">
              {EXPERIENCE.map(e => (
                <button
                  key={e.value}
                  onClick={() => update('experience', e.value)}
                  className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
                    profile.experience === e.value ? 'border border-primary bg-primary-dim text-primary' : 'bg-card border border-border text-text-secondary'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">Days Per Week</label>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map(d => (
                <button
                  key={d}
                  onClick={() => update('days_per_week', d)}
                  className={`flex-1 h-10 rounded-lg text-sm font-bold transition-colors ${
                    profile.days_per_week === d ? 'border border-primary bg-primary-dim text-primary' : 'bg-card border border-border text-text-secondary'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">Equipment</label>
            <div className="space-y-1.5">
              {EQUIPMENT.map(e => (
                <button
                  key={e.value}
                  onClick={() => update('equipment', e.value)}
                  className={`w-full h-11 rounded-xl border text-left px-4 text-sm font-medium transition-colors ${
                    profile.equipment === e.value ? 'border-primary bg-primary-dim text-primary' : 'border-border bg-card text-text-secondary'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'squat_1rm', label: 'Squat 1RM' },
              { key: 'bench_1rm', label: 'Bench 1RM' },
              { key: 'deadlift_1rm', label: 'Deadlift 1RM' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">{f.label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={profile[f.key] || ''}
                  onChange={(e) => update(f.key, e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full h-10 px-3 rounded-lg bg-card border border-border text-text text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">Priority Muscles</label>
            <div className="flex gap-2 flex-wrap">
              {MUSCLE_GROUPS.map(m => {
                const val = m.toLowerCase()
                const selected = (profile.priority_muscles || []).includes(val)
                return (
                  <button
                    key={val}
                    onClick={() => {
                      const current = profile.priority_muscles || []
                      update('priority_muscles', selected ? current.filter(v => v !== val) : [...current, val])
                    }}
                    className={`h-9 px-3 rounded-lg text-xs font-medium transition-colors ${
                      selected ? 'border border-primary bg-primary-dim text-primary' : 'bg-card border border-border text-text-secondary'
                    }`}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">Training Time</label>
            <div className="flex gap-2 flex-wrap">
              {TRAINING_TIMES.map(t => (
                <button
                  key={t.value}
                  onClick={() => update('training_time', t.value)}
                  className={`h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                    profile.training_time === t.value ? 'border border-primary bg-primary-dim text-primary' : 'bg-card border border-border text-text-secondary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full h-12 bg-primary text-bg font-semibold rounded-xl"
          >
            Save Changes
          </button>
        </div>
      )}

      <button
        onClick={() => signOut()}
        className="w-full h-12 border border-danger text-danger font-medium rounded-xl flex items-center justify-center gap-2 mb-8"
      >
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  )
}
