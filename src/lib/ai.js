const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS = 4096

function repairJson(text) {
  const startIdx = text.indexOf('{')
  if (startIdx === -1) throw new Error('No JSON found in Claude response')

  // Find the matching closing brace by tracking depth
  let depth = 0
  let inString = false
  let escaped = false
  let endIdx = -1

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\' && inString) { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    if (ch === '}') { depth--; if (depth === 0) { endIdx = i; break } }
  }

  // If we found a complete JSON object, extract just that
  if (endIdx !== -1) {
    return JSON.parse(text.slice(startIdx, endIdx + 1))
  }

  // Truncated response — try to repair by closing open brackets/braces
  let repaired = text.slice(startIdx)
  // Remove trailing incomplete values
  repaired = repaired.replace(/,\s*"[^"]*$/, '')
  repaired = repaired.replace(/,\s*$/, '')

  depth = 0
  let openBrackets = 0
  inString = false
  escaped = false
  for (const ch of repaired) {
    if (escaped) { escaped = false; continue }
    if (ch === '\\' && inString) { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    if (ch === '}') depth--
    if (ch === '[') openBrackets++
    if (ch === ']') openBrackets--
  }

  while (openBrackets > 0) { repaired += ']'; openBrackets-- }
  while (depth > 0) { repaired += '}'; depth-- }

  return JSON.parse(repaired)
}

async function callClaude(systemPrompt, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error: ${res.status} - ${err}`)
  }

  const data = await res.json()
  const text = data.content[0].text
  return repairJson(text)
}

export async function generateProgram(userProfile) {
  const system = 'You are an expert strength and conditioning coach. You create highly personalized programs based on each athlete\'s unique profile, goals, body composition, and preferences.'
  const prompt = `Generate a personalized training program based on this athlete profile:
- Name: ${userProfile.first_name || 'Athlete'}
- Age: ${userProfile.age || 'unknown'}
- Gender: ${userProfile.gender || 'not specified'}
- Height: ${userProfile.height_inches ? `${Math.floor(userProfile.height_inches / 12)}'${userProfile.height_inches % 12}"` : 'unknown'}
- Weight: ${userProfile.weight_lbs || 'unknown'} lbs
- Goal: ${userProfile.goal}
- Experience: ${userProfile.experience}
- Days per week: ${userProfile.days_per_week}
- Equipment: ${userProfile.equipment}
- Limitations: ${(userProfile.limitations || []).join(', ') || 'None'}
- Priority muscles: ${(userProfile.priority_muscles || []).join(', ') || 'None specified'}
- Preferred training time: ${userProfile.training_time || 'No preference'}
- Estimated 1RMs: Squat ${userProfile.squat_1rm || 'unknown'}lbs, Bench ${userProfile.bench_1rm || 'unknown'}lbs, Deadlift ${userProfile.deadlift_1rm || 'unknown'}lbs
- Additional context: ${userProfile.additional_context || 'None'}

Return ONLY valid JSON in this exact structure, no other text:
{
  "program": {
    "name": "string",
    "description": "string",
    "rationale": "string (2-3 sentences explaining why this program fits their goal and profile)",
    "category": "string",
    "weeks": number,
    "days_per_week": number,
    "workout_days": [
      {
        "name": "string",
        "order_index": number,
        "exercises": [
          {
            "name": "string",
            "muscle_group": "string",
            "movement_type": "string",
            "order_index": number,
            "target_sets": number,
            "target_reps": number,
            "target_weight": number,
            "notes": "string"
          }
        ]
      }
    ]
  }
}`

  return callClaude(system, prompt)
}

export async function generateWeeklyAdaptation(userProfile, weekSessions) {
  const system = 'You are a strength coach reviewing an athlete\'s training week.'
  const prompt = `Athlete profile: ${JSON.stringify(userProfile)}

This week's training data: ${JSON.stringify(weekSessions)}

Analyze their performance and return ONLY valid JSON:
{
  "adaptations": [
    {
      "exercise_name": "string",
      "suggestion": "string (concise, specific, actionable)",
      "type": "progress | deload | swap | form"
    }
  ],
  "week_summary": "string (1-2 sentences, coaching tone)"
}`

  return callClaude(system, prompt)
}

export async function detectPlateaus(exerciseName, weight, sessions, repHistory) {
  const system = 'You are a strength coach helping an athlete break through a plateau.'
  const prompt = `An athlete has stalled on ${exerciseName} at ${weight}lbs for ${sessions} consecutive sessions (reps: ${JSON.stringify(repHistory)}).

Suggest a specific intervention. Return ONLY valid JSON:
{
  "plateau_suggestion": "string",
  "alternative_exercise": "string or null"
}`

  return callClaude(system, prompt)
}

export async function generatePostWorkoutInsight(userProfile, currentSession, recentSessions) {
  const system = 'You are a sharp, direct strength coach reviewing an athlete\'s session.'

  const sessionSummary = formatSessionForPrompt(currentSession)
  const recentSummary = recentSessions.map(s => formatSessionForPrompt(s)).join('\n---\n')

  const prompt = `Athlete profile: ${userProfile.goal} | ${userProfile.experience} | ${userProfile.days_per_week} days/week

Today's session: ${sessionSummary}

Recent history (last ${recentSessions.length} sessions):
${recentSummary || 'No prior sessions'}

Write ONE coaching insight about this session. Rules:
- Maximum 2 sentences
- Be specific — reference actual numbers from their data
- Identify either: a positive trend, a concern, or an actionable next step
- Never say "great job", "well done", or use generic praise
- Tone: direct, knowledgeable, like a coach who has watched every session

Return ONLY valid JSON:
{
  "insight": "string",
  "type": "progress | warning | recommendation",
  "priority": "high | medium | low"
}`

  return callClaude(system, prompt)
}

export async function generatePreWorkoutPrimer(userProfile, workoutDay, exerciseHistory) {
  const system = 'You are a strength coach preparing an athlete for their session.'

  const exerciseList = (workoutDay.workout_exercises || [])
    .map(we => we.exercises?.name || 'Unknown')
    .join(', ')

  const historyText = Object.entries(exerciseHistory)
    .map(([exId, sets]) => {
      if (!sets.length) return null
      const name = sets[0]?.exercises?.name || exId
      const grouped = {}
      sets.forEach(s => {
        const date = new Date(s.sessions?.finished_at).toLocaleDateString()
        if (!grouped[date]) grouped[date] = []
        grouped[date].push(`${s.weight || 0}×${s.reps || 0}${s.completed ? '' : ' (missed)'}`)
      })
      return `${name}:\n${Object.entries(grouped).map(([d, s]) => `  ${d}: ${s.join(', ')}`).join('\n')}`
    })
    .filter(Boolean)
    .join('\n')

  const prompt = `Today's workout: ${workoutDay.name}
Planned exercises: ${exerciseList}

For each exercise, here is the athlete's recent performance:
${historyText || 'No prior data for these exercises'}

Athlete profile: ${userProfile.goal} | ${userProfile.experience}

Write a pre-workout primer. Rules:
- 2-3 sentences maximum
- Lead with the most important exercise focus for today
- Reference specific numbers (e.g. "You hit 225×5 last time at RPE 8")
- Give one concrete target or cue for today's session
- Never be vague or generic

Return ONLY valid JSON:
{
  "primer": "string",
  "focus_exercise": "string",
  "recommended_adjustments": [
    {
      "exercise_name": "string",
      "recommended_weight": number,
      "recommended_reps": number,
      "reasoning": "string (one short phrase)"
    }
  ]
}`

  return callClaude(system, prompt)
}

function formatSessionForPrompt(session) {
  if (!session) return 'No data'
  const sets = session.session_sets || []
  const exercises = {}
  sets.forEach(s => {
    const name = s.exercises?.name || 'Unknown'
    if (!exercises[name]) exercises[name] = []
    exercises[name].push({
      weight: s.weight,
      reps: s.reps,
      completed: s.completed,
    })
  })
  const duration = session.duration_seconds ? `${Math.round(session.duration_seconds / 60)}min` : 'unknown'
  const dayName = session.workout_days?.name || 'Session'
  const completionRate = sets.length > 0
    ? Math.round(sets.filter(s => s.completed).length / sets.length * 100)
    : 0

  let summary = `${dayName} (${duration}, ${completionRate}% completion)`
  for (const [name, data] of Object.entries(exercises)) {
    const setsStr = data.map(d => `${d.weight || 0}×${d.reps || 0}${d.completed ? '' : '(X)'}`).join(', ')
    summary += `\n  ${name}: ${setsStr}`
  }
  if (session.notes) summary += `\n  Notes: ${session.notes}`
  return summary
}
