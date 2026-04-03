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
  const system = 'You are an expert strength and conditioning coach.'
  const prompt = `Generate a personalized training program based on this athlete profile:
- Goal: ${userProfile.goal}
- Experience: ${userProfile.experience}
- Days per week: ${userProfile.days_per_week}
- Equipment: ${userProfile.equipment}
- Limitations: ${(userProfile.limitations || []).join(', ') || 'None'}
- Estimated 1RMs: Squat ${userProfile.squat_1rm || 'unknown'}lbs, Bench ${userProfile.bench_1rm || 'unknown'}lbs, Deadlift ${userProfile.deadlift_1rm || 'unknown'}lbs

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
