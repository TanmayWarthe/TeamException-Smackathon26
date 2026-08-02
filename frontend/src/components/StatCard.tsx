import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  accentColor?: string
}

export default function StatCard({ label, value, icon: Icon, accentColor = 'text-cyan-400' }: StatCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-400 text-sm">{label}</p>
        <Icon size={18} className={accentColor} />
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  )
}