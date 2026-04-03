import { useLocation, useNavigate } from 'react-router-dom'
import { Home, ClipboardList, Clock, Zap } from 'lucide-react'

const tabs = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/programs', icon: ClipboardList, label: 'Programs' },
  { path: '/history', icon: Clock, label: 'History' },
  { path: '/coach', icon: Zap, label: 'Coach' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-bg/95 backdrop-blur-md border-t border-border flex z-50">
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = location.pathname.startsWith(path)
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex-1 flex flex-col items-center py-2.5 gap-1 transition-colors"
          >
            <Icon size={20} strokeWidth={active ? 2.2 : 1.5} className={active ? 'text-primary' : 'text-muted'} />
            <span className={`text-[10px] font-medium tracking-wide uppercase ${active ? 'text-primary' : 'text-muted'}`}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
