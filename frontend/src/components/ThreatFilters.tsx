import { Search } from 'lucide-react'

interface ThreatFiltersProps {
  search: string
  onSearchChange: (val: string) => void
  riskFilter: string
  onRiskFilterChange: (val: string) => void
  statusFilter: string
  onStatusFilterChange: (val: string) => void
}

export default function ThreatFilters({
  search,
  onSearchChange,
  riskFilter,
  onRiskFilterChange,
  statusFilter,
  onStatusFilterChange,
}: ThreatFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by domain..."
          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
        />
      </div>

      <select
        value={riskFilter}
        onChange={(e) => onRiskFilterChange(e.target.value)}
        className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
      >
        <option value="ALL">All Risk Levels</option>
        <option value="CRITICAL">Critical (91-100)</option>
        <option value="HIGH">High (71-90)</option>
        <option value="SUSPICIOUS">Suspicious (51-70)</option>
        <option value="LOW">Low (26-50)</option>
        <option value="TRUSTED">Trusted (0-25)</option>
      </select>

      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
      >
        <option value="ALL">All Status</option>
        <option value="ACTIVE">Active</option>
        <option value="BLOCKED">Blocked</option>
        <option value="RESOLVED">Resolved</option>
        <option value="IGNORED">Ignored</option>
      </select>
    </div>
  )
}