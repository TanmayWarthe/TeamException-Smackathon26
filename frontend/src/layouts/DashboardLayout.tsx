import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, ShieldAlert, Fingerprint, Bell, LogOut, Shield } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { mockNotifications } from '../services/mockData'

const navItems = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/threats', label: 'Threats', icon: ShieldAlert },
  { path: '/digital-twins', label: 'Digital Twins', icon: Fingerprint },
  { path: '/notifications', label: 'Notifications', icon: Bell },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)

  const unreadCount = mockNotifications.filter((n) => !n.read_status).length

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) =>
    path === '/threats'
      ? location.pathname === path || location.pathname.startsWith('/threats/')
      : location.pathname === path

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <Shield className="text-cyan-400" size={18} />
          </div>
          <h2 className="text-white font-bold text-lg">CTIP</h2>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = isActive(path)
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-slate-300 hover:bg-slate-800 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={18} /> {label}
                </span>
                {label === 'Notifications' && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-slate-400 hover:text-red-400 px-3 py-2 text-sm"
        >
          <LogOut size={18} /> Logout
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/50">
          <div />
          <div className="flex items-center gap-4">
            <Link to="/notifications" className="relative text-slate-400 hover:text-white">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 text-sm font-semibold">
                {user?.name?.[0] ?? 'A'}
              </div>
              <div className="text-sm">
                <p className="text-white leading-tight">{user?.name ?? 'Administrator'}</p>
                <p className="text-slate-500 text-xs leading-tight">{user?.role ?? 'ADMIN'}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}