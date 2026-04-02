import { useLocation, useNavigate } from 'react-router-dom'
import { Home, ClipboardList, Clock, Zap } from 'lucide-react'

const tabs = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/programs', icon: ClipboardList, label: 'Programs' },
  { path: '/history', icon: Clock, label: 'History' },
  { path: '/coach', icon: Zap, label: 'AI Coach' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-border flex z-50 safe-area-pb">
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = location.pathname.startsWith(path)
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex-1 flex flex-col items-center py-2 pt-3 gap-0.5 transition-colors ${
              active ? 'text-primary' : 'text-muted'
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
