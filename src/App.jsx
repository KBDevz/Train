import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { UnitsProvider } from './contexts/UnitsContext'
import { supabase } from './lib/supabase'
import BottomNav from './components/BottomNav'
import AuthScreen from './screens/AuthScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import HomeScreen from './screens/HomeScreen'
import ProgramsScreen from './screens/ProgramsScreen'
import ProgramDetailScreen from './screens/ProgramDetailScreen'
import CreateProgramScreen from './screens/CreateProgramScreen'
import WorkoutScreen from './screens/WorkoutScreen'
import HistoryScreen from './screens/HistoryScreen'
import ExerciseLibraryScreen from './screens/ExerciseLibraryScreen'
import CoachScreen from './screens/CoachScreen'
import ProfileScreen from './screens/ProfileScreen'
import LoadingSpinner from './components/LoadingSpinner'

function AppRoutes() {
  const { user, loading } = useAuth()
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)

  useEffect(() => {
    if (!user) { setCheckingProfile(false); return }
    supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setHasProfile(!!data)
        setCheckingProfile(false)
      })
      .catch(() => setCheckingProfile(false))
  }, [user])

  if (loading || (user && checkingProfile)) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <LoadingSpinner message="Loading TrainLocal..." />
      </div>
    )
  }

  if (!user) return <AuthScreen />
  if (!hasProfile) return <OnboardingScreen />

  return (
    <AppShell>
      <Routes>
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/programs" element={<ProgramsScreen />} />
        <Route path="/programs/create" element={<CreateProgramScreen />} />
        <Route path="/programs/:id" element={<ProgramDetailScreen />} />
        <Route path="/workout" element={<WorkoutScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/exercises" element={<ExerciseLibraryScreen />} />
        <Route path="/coach" element={<CoachScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AppShell>
  )
}

function AppShell({ children }) {
  const location = useLocation()
  const hideNav = location.pathname === '/workout'

  return (
    <>
      <div className="fade-enter fade-enter-active">
        {children}
      </div>
      {!hideNav && <BottomNav />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UnitsProvider>
          <AppRoutes />
        </UnitsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
