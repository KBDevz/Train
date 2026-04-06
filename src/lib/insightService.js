import { supabase } from './supabase'

export async function saveInsight(userId, sessionId, type, content, metadata) {
  const { data, error } = await supabase
    .from('ai_insights')
    .insert({
      user_id: userId,
      session_id: sessionId,
      type,
      content,
      metadata,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchRecentInsights(userId, limit = 10) {
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('user_id', userId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function markInsightRead(insightId) {
  const { error } = await supabase
    .from('ai_insights')
    .update({ read: true })
    .eq('id', insightId)
  if (error) throw error
}

export async function dismissInsight(insightId) {
  const { error } = await supabase
    .from('ai_insights')
    .update({ dismissed: true })
    .eq('id', insightId)
  if (error) throw error
}

export async function fetchRecentSessions(userId, limit = 10) {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      workout_days (name),
      session_sets (
        *,
        exercises (name, muscle_group)
      )
    `)
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function fetchExerciseHistory(userId, exerciseIds, sessionsPerExercise = 3) {
  const history = {}
  for (const exId of exerciseIds) {
    const { data } = await supabase
      .from('session_sets')
      .select(`
        *,
        sessions!inner (user_id, finished_at, started_at)
      `)
      .eq('sessions.user_id', userId)
      .eq('exercise_id', exId)
      .not('sessions.finished_at', 'is', null)
      .order('sessions(finished_at)', { ascending: false })
      .limit(sessionsPerExercise * 6)
    history[exId] = data || []
  }
  return history
}

export async function saveMilestone(userId, type, exerciseName, value, previousValue) {
  const { data, error } = await supabase
    .from('milestones')
    .insert({
      user_id: userId,
      type,
      exercise_name: exerciseName,
      value,
      previous_value: previousValue,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveTrainingNote(userId, sessionId, note, parsedContext) {
  const { data, error } = await supabase
    .from('training_notes')
    .insert({
      user_id: userId,
      session_id: sessionId,
      note,
      parsed_context: parsedContext,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
