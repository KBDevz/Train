import { supabase } from './supabase'

export async function saveProgramToDb(userId, program) {
  const { data: prog, error: progError } = await supabase
    .from('programs')
    .insert({
      user_id: userId,
      name: program.name,
      description: program.description + (program.rationale ? '\n\nRationale: ' + program.rationale : ''),
      category: program.category,
      weeks: program.weeks,
      days_per_week: program.days_per_week,
      ai_generated: true,
    })
    .select()
    .single()

  if (progError) throw progError

  for (const day of program.workout_days) {
    const { data: wDay, error: dayError } = await supabase
      .from('workout_days')
      .insert({
        program_id: prog.id,
        name: day.name,
        order_index: day.order_index,
      })
      .select()
      .single()

    if (dayError) throw dayError

    for (const ex of day.exercises) {
      // Find or create exercise
      let exerciseId
      const { data: existing } = await supabase
        .from('exercises')
        .select('id')
        .or(`and(name.ilike.${ex.name},is_global.eq.true),and(name.ilike.${ex.name},user_id.eq.${userId})`)
        .limit(1)

      if (existing && existing.length > 0) {
        exerciseId = existing[0].id
      } else {
        const { data: newEx } = await supabase
          .from('exercises')
          .insert({
            user_id: userId,
            name: ex.name,
            muscle_group: ex.muscle_group,
            movement_type: ex.movement_type,
          })
          .select()
          .single()
        exerciseId = newEx.id
      }

      await supabase.from('workout_exercises').insert({
        workout_day_id: wDay.id,
        exercise_id: exerciseId,
        order_index: ex.order_index,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
        target_weight: ex.target_weight,
        notes: ex.notes,
      })
    }
  }

  return prog
}

export async function fetchPrograms(userId) {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchProgramDetail(programId) {
  const { data: program } = await supabase
    .from('programs')
    .select('*')
    .eq('id', programId)
    .single()

  const { data: days } = await supabase
    .from('workout_days')
    .select(`
      *,
      workout_exercises (
        *,
        exercises (*)
      )
    `)
    .eq('program_id', programId)
    .order('order_index')

  // Sort exercises within each day
  if (days) {
    days.forEach(day => {
      day.workout_exercises?.sort((a, b) => a.order_index - b.order_index)
    })
  }

  return { program, days }
}

export async function fetchExerciseLibrary(userId) {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .or(`is_global.eq.true,user_id.eq.${userId}`)
    .order('name')
  if (error) throw error
  return data
}

export async function deleteProgram(programId) {
  const { error } = await supabase
    .from('programs')
    .delete()
    .eq('id', programId)
  if (error) throw error
}
