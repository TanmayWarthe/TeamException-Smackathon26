import { Bell } from 'lucide-react'
import { mockNotifications } from '../services/mockData'

export default function Notifications() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold text-white">Notifications</h1>
      <div className="space-y-2">
        {mockNotifications.map((n) => (
          <div
            key={n.id}
            className={`bg-slate-900 border rounded-xl p-4 flex gap-3 ${
              n.read_status ? 'border-slate-800' : 'border-cyan-500/30'
            }`}
          >
            <Bell size={18} className={n.read_status ? 'text-slate-500' : 'text-cyan-400'} />
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{n.title}</p>
              <p className="text-slate-400 text-sm mt-0.5">{n.message}</p>
              <p className="text-slate-500 text-xs mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}