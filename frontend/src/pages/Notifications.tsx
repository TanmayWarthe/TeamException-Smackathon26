import { Bell, CheckCheck, ArrowRight, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRealtime } from '../context/RealtimeContext'

export default function Notifications() {
  const { notifications, unreadCount, markNotificationAsRead, markAllNotificationsAsRead } = useRealtime()

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">System Alerts & Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Real-time security events and high-risk domain alerts
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsAsRead}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs transition"
          >
            <CheckCheck size={14} className="text-cyan-400" /> Mark all read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {notifications.length > 0 ? (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read_status && markNotificationAsRead(n.id)}
              className={`bg-slate-900 border rounded-2xl p-4 flex items-start gap-3.5 transition duration-150 cursor-pointer ${
                n.read_status
                  ? 'border-slate-800/80 opacity-75 hover:opacity-100 hover:border-slate-700'
                  : 'border-cyan-500/40 bg-slate-900/90 shadow-md shadow-cyan-950/20'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  n.read_status ? 'bg-slate-800 text-slate-400' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                }`}
              >
                {n.title.toLowerCase().includes('critical') || n.title.toLowerCase().includes('threat') ? (
                  <ShieldAlert size={18} className={!n.read_status ? 'text-red-400' : ''} />
                ) : (
                  <Bell size={18} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className={`text-sm font-semibold truncate ${n.read_status ? 'text-slate-300' : 'text-white'}`}>
                    {n.title}
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono shrink-0">
                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{n.message}</p>

                {n.threat_id && (
                  <div className="mt-2.5 flex items-center">
                    <Link
                      to={`/threats/${n.threat_id}`}
                      className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
                    >
                      Investigate Threat <ArrowRight size={12} />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <Bell size={24} className="mx-auto text-slate-600 mb-2" />
            <p className="font-semibold text-slate-300 text-sm">No notifications</p>
            <p className="text-xs text-slate-500 mt-1">You're all caught up! New threats will ping you in real time.</p>
          </div>
        )}
      </div>
    </div>
  )
}