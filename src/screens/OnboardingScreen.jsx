import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateProgram } from '../lib/ai'
import { saveProgramToDb } from '../lib/programService'
import { Send, Zap } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

const STEPS = [
  {
    id: 'welcome',
    messages: ["Hey! I'm your Cadence coach.", "Let's get to know each other so I can build you a personalized program.", "What's your first name?"],
    type: 'text',
    field: 'first_name',
    placeholder: 'Your first name',
  },
  {
    id: 'age',
    messages: ["{first_name}, great to meet you.", "How old are you?"],
    type: 'number',
    field: 'age',
    placeholder: 'Age',
  },
  {
    id: 'gender',
    messages: ["Got it. And how should I tailor your programming?"],
    type: 'chips',
    field: 'gender',
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other' },
      { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'height_weight',
    messages: ["What's your current height and weight?"],
    type: 'height_weight',
  },
  {
    id: 'goal',
    messages: ["Now the important stuff.", "What's your primary training goal?"],
    type: 'chips',
    field: 'goal',
    options: [
      { value: 'fat_loss', label: 'Lose Fat' },
      { value: 'muscle_gain', label: 'Build Muscle' },
      { value: 'strength', label: 'Get Stronger' },
      { value: 'endurance', label: 'Build Endurance' },
      { value: 'general', label: 'General Fitness' },
    ],
  },
  {
    id: 'goal_detail',
    messages: ["{goal_followup}"],
    type: 'text',
    field: 'goal_detail',
    placeholder: 'e.g. 15 lbs, 185 lbs, etc.',
    skip: true,
  },
  {
    id: 'priority_muscles',
    messages: ["Any areas you want to prioritize?", "Pick as many as you want, or skip."],
    type: 'multi_chips',
    field: 'priority_muscles',
    options: [
      { value: 'chest', label: 'Chest' },
      { value: 'back', label: 'Back' },
      { value: 'shoulders', label: 'Shoulders' },
      { value: 'arms', label: 'Arms' },
      { value: 'legs', label: 'Legs' },
      { value: 'core', label: 'Core' },
      { value: 'glutes', label: 'Glutes' },
    ],
    skip: true,
  },
  {
    id: 'experience',
    messages: ["How long have you been training?"],
    type: 'chips',
    field: 'experience',
    options: [
      { value: 'beginner', label: 'Under 1 year' },
      { value: 'intermediate', label: '1-3 years' },
      { value: 'advanced', label: '3+ years' },
    ],
  },
  {
    id: 'days',
    messages: ["How many days per week can you commit to training?"],
    type: 'chips',
    field: 'days_per_week',
    options: [
      { value: 2, label: '2' },
      { value: 3, label: '3' },
      { value: 4, label: '4' },
      { value: 5, label: '5' },
      { value: 6, label: '6' },
    ],
  },
  {
    id: 'equipment',
    messages: ["What equipment do you have access to?"],
    type: 'chips',
    field: 'equipment',
    options: [
      { value: 'full_gym', label: 'Full Gym' },
      { value: 'home_gym', label: 'Home Gym' },
      { value: 'dumbbells', label: 'Dumbbells Only' },
      { value: 'bodyweight', label: 'Bodyweight Only' },
    ],
  },
  {
    id: 'limitations',
    messages: ["Any injuries or limitations I should know about?"],
    type: 'multi_chips',
    field: 'limitations',
    options: [
      { value: 'Lower Back', label: 'Lower Back' },
      { value: 'Knees', label: 'Knees' },
      { value: 'Shoulders', label: 'Shoulders' },
      { value: 'Hips', label: 'Hips' },
      { value: 'Wrists', label: 'Wrists' },
    ],
    skip: true,
  },
  {
    id: 'training_time',
    messages: ["When do you prefer to train?"],
    type: 'chips',
    field: 'training_time',
    options: [
      { value: 'morning', label: 'Morning' },
      { value: 'afternoon', label: 'Afternoon' },
      { value: 'evening', label: 'Evening' },
      { value: 'no_preference', label: 'No preference' },
    ],
  },
  {
    id: 'lifts',
    messages: ["Last question.", "Do you know your current maxes? If not, just skip — I'll figure it out."],
    type: 'lifts',
    skip: true,
  },
  {
    id: 'anything_else',
    messages: ["Anything else I should know?", "Training history, preferences, injuries — whatever comes to mind."],
    type: 'text',
    field: 'additional_context',
    placeholder: 'Anything else... (optional)',
    skip: true,
  },
]

function getGoalFollowup(goal) {
  switch (goal) {
    case 'muscle_gain': return "Nice. How many lbs of muscle are you looking to put on?"
    case 'fat_loss': return "What's your target weight?"
    case 'strength': return "Any specific lift numbers you're chasing? (e.g. 315 squat)"
    case 'endurance': return "What's your endurance goal? (e.g. run a 5K, improve stamina)"
    case 'general': return "Any specific outcomes you're hoping for?"
    default: return "Tell me more about what you're aiming for."
  }
}

export default function OnboardingScreen({ onComplete }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [chatHistory, setChatHistory] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [multiSelect, setMultiSelect] = useState([])
  const [generating, setGenerating] = useState(false)
  const [typingDots, setTypingDots] = useState(false)
  const [heightFt, setHeightFt] = useState('')
  const [heightIn, setHeightIn] = useState('')
  const [weightVal, setWeightVal] = useState('')
  const [squat, setSquat] = useState('')
  const [bench, setBench] = useState('')
  const [deadlift, setDeadlift] = useState('')
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)
  const initRef = useRef(false)

  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    age: null,
    gender: '',
    height_inches: null,
    weight_lbs: null,
    goal: '',
    goal_detail: '',
    target_weight_lbs: null,
    priority_muscles: [],
    experience: '',
    days_per_week: 4,
    equipment: '',
    limitations: [],
    training_time: '',
    squat_1rm: null,
    bench_1rm: null,
    deadlift_1rm: null,
    additional_context: '',
  })

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    showStepMessages(0)
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, typingDots])

  function showStepMessages(stepIdx) {
    const step = STEPS[stepIdx]
    if (!step) return

    let messages = step.messages.map(msg => {
      return msg
        .replace('{first_name}', profile.first_name || 'there')
        .replace('{goal_followup}', getGoalFollowup(profile.goal))
    })

    // Animate messages one by one
    setTypingDots(true)
    let delay = 400
    messages.forEach((msg, i) => {
      setTimeout(() => {
        setChatHistory(prev => [...prev, { type: 'coach', text: msg }])
        if (i === messages.length - 1) {
          setTypingDots(false)
          setTimeout(() => inputRef.current?.focus(), 100)
        }
      }, delay)
      delay += Math.min(msg.length * 15, 800)
    })
  }

  function handleResponse(value, displayText) {
    // Add user response to chat
    setChatHistory(prev => [...prev, { type: 'user', text: displayText || String(value) }])

    // Update profile
    const step = STEPS[currentStep]
    if (step?.field) {
      setProfile(prev => ({ ...prev, [step.field]: value }))
    }

    // Move to next step
    const nextStep = currentStep + 1
    if (nextStep >= STEPS.length) {
      handleFinish({ ...profile, [step?.field]: value })
    } else {
      setCurrentStep(nextStep)
      setInputValue('')
      setMultiSelect([])
      // Need to use updated profile for message interpolation
      setTimeout(() => {
        const updatedProfile = { ...profile, [step?.field]: value }
        showStepMessagesWithProfile(nextStep, updatedProfile)
      }, 300)
    }
  }

  function showStepMessagesWithProfile(stepIdx, prof) {
    const step = STEPS[stepIdx]
    if (!step) return

    let messages = step.messages.map(msg => {
      return msg
        .replace('{first_name}', prof.first_name || 'there')
        .replace('{goal_followup}', getGoalFollowup(prof.goal))
    })

    setTypingDots(true)
    let delay = 400
    messages.forEach((msg, i) => {
      setTimeout(() => {
        setChatHistory(prev => [...prev, { type: 'coach', text: msg }])
        if (i === messages.length - 1) {
          setTypingDots(false)
          setTimeout(() => inputRef.current?.focus(), 100)
        }
      }, delay)
      delay += Math.min(msg.length * 15, 800)
    })
  }

  function handleSkip() {
    setChatHistory(prev => [...prev, { type: 'user', text: 'Skip' }])
    const nextStep = currentStep + 1
    if (nextStep >= STEPS.length) {
      handleFinish(profile)
    } else {
      setCurrentStep(nextStep)
      setInputValue('')
      setMultiSelect([])
      setTimeout(() => showStepMessagesWithProfile(nextStep, profile), 300)
    }
  }

  function handleTextSubmit() {
    if (!inputValue.trim()) return
    const step = STEPS[currentStep]
    const value = step?.type === 'number' ? parseInt(inputValue) : inputValue.trim()
    handleResponse(value, inputValue.trim())
  }

  function handleHeightWeightSubmit() {
    if (!weightVal) return
    const totalInches = (parseInt(heightFt) || 0) * 12 + (parseInt(heightIn) || 0)
    const updatedProfile = {
      ...profile,
      height_inches: totalInches || null,
      weight_lbs: parseFloat(weightVal) || null,
    }
    setProfile(updatedProfile)
    const display = `${heightFt || '?'}'${heightIn || '0'}" · ${weightVal} lbs`
    setChatHistory(prev => [...prev, { type: 'user', text: display }])

    const nextStep = currentStep + 1
    setCurrentStep(nextStep)
    setTimeout(() => showStepMessagesWithProfile(nextStep, updatedProfile), 300)
  }

  function handleLiftsSubmit() {
    const updatedProfile = {
      ...profile,
      squat_1rm: squat ? parseFloat(squat) : null,
      bench_1rm: bench ? parseFloat(bench) : null,
      deadlift_1rm: deadlift ? parseFloat(deadlift) : null,
    }
    setProfile(updatedProfile)
    const parts = []
    if (squat) parts.push(`S: ${squat}`)
    if (bench) parts.push(`B: ${bench}`)
    if (deadlift) parts.push(`D: ${deadlift}`)
    const display = parts.length > 0 ? parts.join(' / ') : 'No maxes yet'
    setChatHistory(prev => [...prev, { type: 'user', text: display }])

    const nextStep = currentStep + 1
    setCurrentStep(nextStep)
    setTimeout(() => showStepMessagesWithProfile(nextStep, updatedProfile), 300)
  }

  function handleChipSelect(value, label) {
    handleResponse(value, label)
  }

  function handleMultiChipToggle(value) {
    setMultiSelect(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  function handleMultiChipSubmit() {
    handleResponse(multiSelect, multiSelect.length > 0 ? multiSelect.join(', ') : 'None')
  }

  async function handleFinish(finalProfile) {
    setGenerating(true)
    setChatHistory(prev => [...prev, { type: 'coach', text: `Perfect, ${finalProfile.first_name || 'friend'}. I've got everything I need. Building your program now...` }])

    try {
      const dbProfile = {
        user_id: user.id,
        first_name: finalProfile.first_name || null,
        last_name: finalProfile.last_name || null,
        age: finalProfile.age || null,
        gender: finalProfile.gender || null,
        height_inches: finalProfile.height_inches || null,
        weight_lbs: finalProfile.weight_lbs || null,
        target_weight_lbs: finalProfile.target_weight_lbs || null,
        goal: finalProfile.goal || 'general',
        experience: finalProfile.experience || 'beginner',
        days_per_week: finalProfile.days_per_week || 4,
        equipment: finalProfile.equipment || 'full_gym',
        limitations: finalProfile.limitations?.length > 0 ? finalProfile.limitations : null,
        priority_muscles: finalProfile.priority_muscles?.length > 0 ? finalProfile.priority_muscles : null,
        training_time: finalProfile.training_time || null,
        squat_1rm: finalProfile.squat_1rm || null,
        bench_1rm: finalProfile.bench_1rm || null,
        deadlift_1rm: finalProfile.deadlift_1rm || null,
        additional_context: [
          finalProfile.goal_detail ? `Goal detail: ${finalProfile.goal_detail}` : '',
          finalProfile.additional_context || '',
        ].filter(Boolean).join('. ') || null,
      }

      await supabase.from('user_profiles').upsert(dbProfile, { onConflict: 'user_id' })
      onComplete?.()

      try {
        const result = await generateProgram(dbProfile)
        await saveProgramToDb(user.id, result.program)
      } catch (aiErr) {
        console.error('AI program generation failed:', aiErr)
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

  const step = STEPS[currentStep]

  if (generating) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-bg">
        <img src="/cadence-logo.svg" alt="Cadence" className="w-14 h-14 mb-6" />
        <LoadingSpinner message="Building your personalized program..." />
        <p className="text-xs text-muted mt-2">Analyzing your profile & designing your split</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <img src="/cadence-logo.svg" alt="" className="w-7 h-7" />
        <div>
          <p className="text-sm font-semibold text-text">Cadence Coach</p>
          <p className="text-[10px] text-muted uppercase tracking-wider">Initial Consultation</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.type === 'user'
                  ? 'bg-primary text-bg rounded-br-md'
                  : 'bg-card border border-border text-text rounded-bl-md'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {typingDots && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
              <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      {!typingDots && step && (
        <div className="border-t border-border bg-bg px-4 py-3 safe-area-pb">
          {/* Text input */}
          {(step.type === 'text' || step.type === 'number') && (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type={step.type === 'number' ? 'number' : 'text'}
                inputMode={step.type === 'number' ? 'numeric' : 'text'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                className="flex-1 h-11 px-4 rounded-xl bg-card border border-border text-text text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted"
                placeholder={step.placeholder || 'Type your answer...'}
              />
              {step.skip && (
                <button onClick={handleSkip} className="h-11 px-3 text-xs text-muted font-medium">
                  Skip
                </button>
              )}
              <button
                onClick={handleTextSubmit}
                disabled={!inputValue.trim()}
                className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center text-bg disabled:opacity-30"
              >
                <Send size={18} />
              </button>
            </div>
          )}

          {/* Chips (single select) */}
          {step.type === 'chips' && (
            <div className="flex flex-wrap gap-2">
              {step.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleChipSelect(opt.value, opt.label)}
                  className="h-10 px-4 rounded-full bg-card border border-border text-sm font-medium text-text active:bg-primary active:text-bg active:border-primary transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Multi-select chips */}
          {step.type === 'multi_chips' && (
            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                {step.options.map((opt) => {
                  const selected = multiSelect.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleMultiChipToggle(opt.value)}
                      className={`h-10 px-4 rounded-full text-sm font-medium transition-colors ${
                        selected
                          ? 'bg-primary text-bg border border-primary'
                          : 'bg-card border border-border text-text'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2">
                {step.skip && (
                  <button onClick={handleSkip} className="h-10 px-4 text-xs text-muted font-medium">
                    Skip
                  </button>
                )}
                <button
                  onClick={handleMultiChipSubmit}
                  className="flex-1 h-10 bg-primary text-bg rounded-xl text-sm font-semibold"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Height & Weight */}
          {step.type === 'height_weight' && (
            <div>
              <div className="flex gap-2 mb-2">
                <div className="flex items-center gap-1 flex-1">
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="numeric"
                    value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-card border border-border text-text text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted"
                    placeholder="ft"
                  />
                  <span className="text-muted text-sm">'</span>
                </div>
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={heightIn}
                    onChange={(e) => setHeightIn(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-card border border-border text-text text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted"
                    placeholder="in"
                  />
                  <span className="text-muted text-sm">"</span>
                </div>
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={weightVal}
                    onChange={(e) => setWeightVal(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-card border border-border text-text text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted"
                    placeholder="lbs"
                  />
                </div>
              </div>
              <button
                onClick={handleHeightWeightSubmit}
                disabled={!weightVal}
                className="w-full h-10 bg-primary text-bg rounded-xl text-sm font-semibold disabled:opacity-30"
              >
                Continue
              </button>
            </div>
          )}

          {/* Lifts */}
          {step.type === 'lifts' && (
            <div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1 text-center">Squat</p>
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="decimal"
                    value={squat}
                    onChange={(e) => setSquat(e.target.value)}
                    className="w-full h-11 px-2 rounded-xl bg-card border border-border text-text text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted"
                    placeholder="lbs"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1 text-center">Bench</p>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={bench}
                    onChange={(e) => setBench(e.target.value)}
                    className="w-full h-11 px-2 rounded-xl bg-card border border-border text-text text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted"
                    placeholder="lbs"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1 text-center">Deadlift</p>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={deadlift}
                    onChange={(e) => setDeadlift(e.target.value)}
                    className="w-full h-11 px-2 rounded-xl bg-card border border-border text-text text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted"
                    placeholder="lbs"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSkip} className="h-10 px-4 text-xs text-muted font-medium">
                  Skip
                </button>
                <button
                  onClick={handleLiftsSubmit}
                  className="flex-1 h-10 bg-primary text-bg rounded-xl text-sm font-semibold"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
