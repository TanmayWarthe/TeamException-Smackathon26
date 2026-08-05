import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, ShieldAlert, Fingerprint, Bell, LogOut, Shield, Wifi, WifiOff, X, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useRealtime } from '../context/RealtimeContext'

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
  const { isConnected, unreadCount, activeToast, dismissToast } = useRealtime()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) =>
    path === '/threats'
      ? location.pathname === path || location.pathname.startsWith('/threats/')
      : location.pathname === path

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-100">
      {/* Toast Alert Banner */}
      {activeToast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-md w-full p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-0 ${
            activeToast.severity === 'critical'
              ? 'bg-red-950/90 border-red-500/50 text-red-100 shadow-red-950/50'
              : activeToast.severity === 'high'
              ? 'bg-amber-950/90 border-amber-500/50 text-amber-100 shadow-amber-950/50'
              : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-100 shadow-cyan-950/50'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className={`shrink-0 mt-0.5 animate-bounce ${
                activeToast.severity === 'critical'
                  ? 'text-red-400'
                  : activeToast.severity === 'high'
                  ? 'text-amber-400'
                  : 'text-cyan-400'
              }`}
            />
            <div className="flex-1">
              <h4 className="font-bold text-sm tracking-wide">{activeToast.title}</h4>
              <p className="text-xs opacity-90 mt-1 leading-relaxed">{activeToast.message}</p>
            </div>
            <button
              onClick={dismissToast}
              className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shadow-inner">
            <Shield className="text-cyan-400" size={20} />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg tracking-tight">CTIP Shield</h2>
            <p className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Campus Intel</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = isActive(path)
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition duration-150 ${
                  active
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon size={18} className={active ? 'text-cyan-400' : 'text-slate-400'} />
                  {label}
                </span>
                {label === 'Notifications' && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[11px] font-bold rounded-full px-2 py-0.5 shadow-sm animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Real-time Status Widget */}
        <div className="my-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              {isConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Live Intel Stream
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  Reconnecting...
                </>
              )}
            </span>
            {isConnected ? (
              <Wifi size={14} className="text-emerald-400" />
            ) : (
              <WifiOff size={14} className="text-amber-400 animate-pulse" />
            )}
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            {isConnected ? 'WebSocket feed active' : 'Checking socket /ws/alerts'}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-slate-400 hover:text-red-400 px-3 py-2 text-sm rounded-xl hover:bg-slate-800/40 transition"
        >
          <LogOut size={18} /> Logout
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/70 backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase bg-slate-800/80 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/60">
              Institution: YCCE Campus
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/notifications"
              className="relative p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition"
              title="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </Link>
            
            <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-sm font-bold">
                {user?.name?.[0] ?? 'A'}
              </div>
              <div className="text-sm">
                <p className="text-white font-medium leading-tight">{user?.name ?? 'SecOps Admin'}</p>
                <p className="text-slate-500 text-xs leading-tight">{user?.role ?? 'SUPER_ADMIN'}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  )
}