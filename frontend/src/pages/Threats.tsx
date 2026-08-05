import { useState, useEffect, useMemo } from 'react'
import ThreatTable from '../components/ThreatTable'
import ThreatFilters from '../components/ThreatFilters'
import { api } from '../services/api'
import type { Threat } from '../services/mockData'
import { getRiskLevel } from '../constants/theme'

export default function Threats() {
  const [threats, setThreats] = useState<Threat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  useEffect(() => {
    setLoading(true)
    api.getThreats()
      .then((data) => {
        setThreats(data)
        setError(null)
      })
      .catch(() => setError('Could not load threats from server'))
      .finally(() => setLoading(false))
  }, [])

  const filteredThreats = useMemo(() => {
    return threats.filter((t) => {
      const matchesSearch = t.domain.toLowerCase().includes(search.toLowerCase())
      const matchesRisk = riskFilter === 'ALL' || getRiskLevel(t.risk_score) === riskFilter
      const matchesStatus = statusFilter === 'ALL' || t.threat_status === statusFilter
      return matchesSearch && matchesRisk && matchesStatus
    })
  }, [threats, search, riskFilter, statusFilter])

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

      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
          Loading threats...
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center text-red-400">
          {error}
        </div>
      ) : filteredThreats.length > 0 ? (
        <ThreatTable threats={filteredThreats} />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
          No threats detected yet.
        </div>
      )}
    </div>
  )
}