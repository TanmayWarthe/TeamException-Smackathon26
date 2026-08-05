import { useState, useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import ThreatTable from '../components/ThreatTable'
import ThreatFilters from '../components/ThreatFilters'
import { useRealtime } from '../context/RealtimeContext'
import { getRiskLevel } from '../constants/theme'

export default function Threats() {
  const { threats, refreshThreats, isConnected } = useRealtime()
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshThreats()
    setRefreshing(false)
  }

  const filteredThreats = useMemo(() => {
    return threats.filter((t) => {
      const matchesSearch = t.domain.toLowerCase().includes(search.toLowerCase()) || t.url.toLowerCase().includes(search.toLowerCase())
      const matchesRisk = riskFilter === 'ALL' || getRiskLevel(t.risk_score) === riskFilter
      const matchesStatus = statusFilter === 'ALL' || t.threat_status === statusFilter
      return matchesSearch && matchesRisk && matchesStatus
    })
  }, [threats, search, riskFilter, statusFilter])

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Active Threats & Phishing Dossiers</h1>
            <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2.5 py-0.5 rounded-full border border-cyan-500/20 font-medium">
              {filteredThreats.length} total
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Real-time feed of detected campus lookalike domains and credential harvesters
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-300 font-mono text-[11px]">
              {isConnected ? 'Auto-Syncing' : 'Connecting'}
            </span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs transition"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-cyan-400' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <ThreatFilters
        search={search}
        onSearchChange={setSearch}
        riskFilter={riskFilter}
        onRiskFilterChange={setRiskFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {filteredThreats.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <ThreatTable threats={filteredThreats} />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
          <p className="font-semibold text-slate-300">No matching threats found</p>
          <p className="text-xs text-slate-500">
            {search || riskFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Try adjusting your filters or search query.'
              : 'The threat radar is clear. No active threats recorded.'}
          </p>
        </div>
      )}
    </div>
  )
}