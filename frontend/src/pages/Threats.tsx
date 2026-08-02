import { useState, useMemo } from 'react'
import ThreatTable from '../components/ThreatTable'
import ThreatFilters from '../components/ThreatFilters'
import { mockThreats } from '../services/mockData'
import { getRiskLevel } from '../constants/theme'

export default function Threats() {
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const filteredThreats = useMemo(() => {
    return mockThreats.filter((t) => {
      const matchesSearch = t.domain.toLowerCase().includes(search.toLowerCase())
      const matchesRisk = riskFilter === 'ALL' || getRiskLevel(t.risk_score) === riskFilter
      const matchesStatus = statusFilter === 'ALL' || t.threat_status === statusFilter
      return matchesSearch && matchesRisk && matchesStatus
    })
  }, [search, riskFilter, statusFilter])

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">All Threats</h1>
        <span className="text-slate-500 text-sm">{filteredThreats.length} results</span>
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
        <ThreatTable threats={filteredThreats} />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
          No threats match your filters.
        </div>
      )}
    </div>
  )
}