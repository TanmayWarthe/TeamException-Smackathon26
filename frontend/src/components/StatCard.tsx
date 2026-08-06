import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  accentColor?: string
  iconBg?: string
  trend?: string
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  accentColor = 'text-slate-400',
  iconBg = 'bg-slate-800',
  trend,
}: StatCardProps) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm font-medium leading-tight">{label}</p>
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon size={17} className={accentColor} />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-bold text-slate-900 tracking-tight leading-none">{value}</p>
        {trend && (
          <span className="text-xs text-slate-400 font-medium">{trend}</span>
        )}
      </div>
    </div>
  )
}