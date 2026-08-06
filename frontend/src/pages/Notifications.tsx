import { useState } from 'react'
import { Bell, CheckCheck, ArrowRight, ShieldAlert, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRealtime } from '../context/RealtimeContext'

export default function Notifications() {
  const {
    notifications,
    unreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useRealtime()
  const [clearing, setClearing] = useState(false)

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all notifications?')) {
      setClearing(true)
      await clearAllNotifications()
      setClearing(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteNotification(id)
  }

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Alerts & Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-red-50 text-red-700 border border-red-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Real-time security events and high-risk domain alerts
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllNotificationsAsRead}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs transition shadow-xs font-medium cursor-pointer"
            >
              <CheckCheck size={14} className="text-blue-600" /> Mark all read
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="flex items-center gap-1.5 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-xs transition shadow-xs font-medium cursor-pointer"
            >
              <Trash2 size={13} className="text-red-500" />
              {clearing ? 'Clearing...' : 'Clear all'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {notifications.length > 0 ? (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read_status && markNotificationAsRead(n.id)}
              className={`bg-white border rounded-2xl p-4 flex items-start gap-3.5 transition duration-150 cursor-pointer shadow-xs group ${
                n.read_status
                  ? 'border-slate-200 opacity-75 hover:opacity-100 hover:border-slate-300'
                  : 'border-blue-200 bg-blue-50/40'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  n.read_status ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-600 border border-blue-200'
                }`}
              >
                {n.title.toLowerCase().includes('critical') || n.title.toLowerCase().includes('threat') ? (
                  <ShieldAlert size={18} className={!n.read_status ? 'text-red-600' : ''} />
                ) : (
                  <Bell size={18} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className={`text-sm font-semibold truncate ${n.read_status ? 'text-slate-600' : 'text-slate-900'}`}>
                    {n.title}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(n.id, e)}
                      title="Delete notification"
                      className="p-1 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-slate-600 text-xs mt-1 leading-relaxed">{n.message}</p>

                {n.threat_id && (
                  <div className="mt-2.5 flex items-center">
                    <Link
                      to={`/threats/${n.threat_id}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                    >
                      Investigate Threat <ArrowRight size={12} />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
            <Bell size={24} className="mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-900 text-sm">No notifications</p>
            <p className="text-xs text-slate-500 mt-1">You're all caught up! New threats will alert you in real time.</p>
          </div>
        )}
      </div>
    </div>
  )
}