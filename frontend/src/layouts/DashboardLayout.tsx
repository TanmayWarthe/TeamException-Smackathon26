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
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col md:flex-row text-slate-900">
      {/* Toast Alert Banner */}
      {activeToast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-md w-full p-4 rounded-xl border shadow-lg transition-all duration-300 transform translate-y-0 ${
            activeToast.severity === 'critical'
              ? 'bg-red-50 border-red-200 text-red-900'
              : activeToast.severity === 'high'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className={`shrink-0 mt-0.5 ${
                activeToast.severity === 'critical'
                  ? 'text-red-600'
                  : activeToast.severity === 'high'
                    ? 'text-amber-600'
                    : 'text-blue-600'
              }`}
            />
            <div className="flex-1">
              <h4 className="font-bold text-sm tracking-tight">{activeToast.title}</h4>
              <p className="text-xs opacity-90 mt-1 leading-relaxed">{activeToast.message}</p>
            </div>
            <button
              onClick={dismissToast}
              className="text-slate-400 hover:text-slate-700 transition p-1 rounded-lg hover:bg-slate-200/50"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-full md:w-64 h-full bg-white border-r border-slate-200 flex flex-col p-4 shrink-0 z-30">
        <div className="flex items-center gap-2.5 mb-6 px-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Shield className="text-blue-600" size={18} />
          </div>
          <div>
            <h2 className="text-slate-900 font-bold text-base tracking-tight">CTIP</h2>
            <p className="text-slate-500 text-xs font-medium">Campus Threat Intelligence</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto min-h-0 pr-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = isActive(path)
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-blue-50 text-blue-600 font-semibold border border-blue-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon size={18} className={active ? 'text-blue-600' : 'text-slate-400'} />
                  {label}
                </span>
                {label === 'Notifications' && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[11px] font-bold rounded-full px-2 py-0.5 shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Real-time Status Widget & Logout */}
        <div className="mt-auto shrink-0 pt-3 space-y-2 border-t border-slate-100">
          

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-slate-500 hover:text-red-600 px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition font-medium"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 shrink-0 border-b border-slate-200 flex items-center justify-between px-6 bg-white z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
              Institution: YCCE Campus
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/notifications"
              className="relative p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
              title="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-sm font-bold">
                {user?.name?.[0] ?? 'A'}
              </div>
              <div className="text-sm hidden sm:block">
                <p className="text-slate-900 font-medium leading-tight">{user?.name ?? 'Administrator'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}