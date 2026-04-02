import { supabase } from './supabase'

export async function startSession(userId, workoutDayId, programId) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      workout_day_id: workoutDayId,
      program_id: programId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function finishSession(sessionId, durationSeconds, feedbackRating, notes) {
  const { error } = await supabase
    .from('sessions')
    .update({
      finished_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      feedback_rating: feedbackRating,
      notes,
    })
    .eq('id', sessionId)
  if (error) throw error
}

export async function saveSessionSets(sessionId, sets) {
  const rows = sets.map((s) => ({
    session_id: sessionId,
    exercise_id: s.exercise_id,
    set_number: s.set_number,
    reps: s.reps ? parseInt(s.reps) : null,
    weight: s.weight ? parseFloat(s.weight) : null,
    completed: s.completed,
    rpe: s.rpe ? parseFloat(s.rpe) : null,
  }))
  const { error } = await supabase.from('session_sets').insert(rows)
  if (error) throw error
}

export async function fetchSessions(userId) {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      workout_days (name),
      programs (name),
      session_sets (
        *,
        exercises (name)
      )
    `)
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchLastSessionSets(userId, exerciseId) {
  const { data } = await supabase
    .from('session_sets')
    .select(`
      *,
      sessions!inner (user_id, finished_at)
    `)
    .eq('sessions.user_id', userId)
    .eq('exercise_id', exerciseId)
    .not('sessions.finished_at', 'is', null)
    .order('sessions(finished_at)', { ascending: false })
    .limit(10)

  return data || []
}

export async function fetchWeekSessions(userId) {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      session_sets (
        *,
        exercises (name)
      )
    `)
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .gte('started_at', weekAgo.toISOString())
    .order('started_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchStreak(userId) {
  const { data } = await supabase
    .from('sessions')
    .select('started_at')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })

  if (!data || data.length === 0) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dates = [...new Set(data.map(s => {
    const d = new Date(s.started_at)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }))].sort((a, b) => b - a)

  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today)
    expected.setDate(expected.getDate() - i)
    expected.setHours(0, 0, 0, 0)
    if (dates[i] === expected.getTime()) {
      streak++
    } else if (i === 0 && dates[0] === new Date(today.getTime() - 86400000).getTime()) {
      // yesterday counts as start
      streak++
    } else {
      break
    }
  }

  return streak
}
