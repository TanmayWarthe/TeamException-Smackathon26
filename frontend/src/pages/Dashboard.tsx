import { useState, useEffect } from 'react'
import { ShieldAlert, AlertTriangle, Users, Fingerprint, Search, Loader2, Shield, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatCard from '../components/StatCard'
import ThreatTable from '../components/ThreatTable'
import { api } from '../services/api'
import { useRealtime } from '../context/RealtimeContext'

const RISK_BADGE: Record<string, string> = {
  TRUSTED:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  LOW:        'bg-sky-50 text-sky-700 border border-sky-200',
  SUSPICIOUS: 'bg-amber-50 text-amber-700 border border-amber-200',
  HIGH:       'bg-orange-50 text-orange-700 border border-orange-200',
  CRITICAL:   'bg-rose-100 text-rose-800 border border-rose-300',
}

export default function Dashboard() {
  const { threats } = useRealtime()
  const [stats, setStats] = useState({
    total_threats: 0,
    critical: 0,
    high: 0,
    suspicious: 0,
    low: 0,
    trusted: 0,
    students_protected: 0,
    credential_blocks: 0,
    digital_twins: 0,
    average_risk_score: 0,
  })

  const [inspectUrl, setInspectUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [inspectError, setInspectError] = useState<string | null>(null)

  useEffect(() => {
    api.getDashboardStats().then((data) => { if (data) setStats(data) })
  }, [])

  const criticalCount = threats.length > 0 ? threats.filter((t) => t.risk_score >= 90).length : stats.critical
  const totalCount    = threats.length > 0 ? threats.length : stats.total_threats

  const handleInspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let target = inspectUrl.trim()
    if (!target) return

    // Auto-prepend https:// if scheme is missing
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`
      setInspectUrl(target)
    }

    setAnalyzing(true)
    setInspectError(null)
    setAnalysisResult(null)
    try {
      const result = await api.analyzeUrl(target)
      setAnalysisResult(result)
    } catch (err: any) {
      setInspectError(err?.message || 'Failed to analyze URL')
    } finally {
      setAnalyzing(false)
    }
  }

  const scoreColor =
    analysisResult?.risk_score >= 90 ? 'text-red-700'
    : analysisResult?.risk_score >= 70 ? 'text-orange-700'
    : analysisResult?.risk_score >= 50 ? 'text-amber-700'
    : 'text-emerald-700'

  return (
    <div className="p-6 md:p-8 space-y-7 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Campus threat intelligence — real-time analysis &amp; digital twin monitoring
          </p>
        </div>
        {/* <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${
          isConnected
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {isConnected ? 'Live feed active' : 'Reconnecting…'}
        </div> */}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Threats"
          value={totalCount}
          icon={ShieldAlert}
          accentColor="text-slate-700"
          iconBg="bg-slate-100"
          trend="Indexed"
        />
        <StatCard
          label="Critical Active"
          value={criticalCount}
          icon={AlertTriangle}
          accentColor="text-red-600"
          iconBg="bg-red-50"
          trend={criticalCount > 0 ? '⚠ Needs attention' : 'All clear'}
        />
        <StatCard
          label="Students Protected"
          value={stats.students_protected}
          icon={Users}
          accentColor="text-emerald-600"
          iconBg="bg-emerald-50"
          trend="This session"
        />
        <StatCard
          label="Digital Twins"
          value={stats.digital_twins}
          icon={Fingerprint}
          accentColor="text-blue-600"
          iconBg="bg-blue-50"
          trend="Fingerprinted"
        />
      </div>

      {/* AI Inspector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-slate-900 font-semibold text-base">Site Inspector</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Paste any web address to check its security status
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Shield size={17} className="text-blue-600" />
          </div>
        </div>

        <form onSubmit={handleInspectSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={inspectUrl}
              onChange={(e) => setInspectUrl(e.target.value)}
              onBlur={() => {
                const trimmed = inspectUrl.trim()
                if (trimmed && !/^https?:\/\//i.test(trimmed)) {
                  setInspectUrl(`https://${trimmed}`)
                }
              }}
              placeholder="https://jupyter.org or https://suspicious-domain.xyz"
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              disabled={analyzing}
            />
          </div>
          <button
            type="submit"
            disabled={analyzing || !inspectUrl.trim()}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition shrink-0 shadow-xs"
          >
            {analyzing ? (
              <><Loader2 className="animate-spin" size={15} /> Analyzing…</>
            ) : (
              <><Shield size={15} /> Analyze</>
            )}
          </button>
        </form>

        {inspectError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            {inspectError}
          </div>
        )}

        {analysisResult && (
          <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Score */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
              <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Risk Score</span>
              <div className="flex items-end gap-3">
                <span className={`text-4xl font-extrabold leading-none tracking-tight ${scoreColor}`}>
                  {analysisResult.risk_score}
                  <span className="text-xl">%</span>
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md mb-1 ${
                  RISK_BADGE[analysisResult.risk_level] || RISK_BADGE['SUSPICIOUS']
                }`}>
                  {analysisResult.risk_level || analysisResult.status}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Action: <span className="text-slate-900 font-semibold">{analysisResult.recommendation}</span>
              </p>
              {analysisResult.threat_id && (
                <Link
                  to={`/threats/${analysisResult.threat_id}`}
                  className="mt-auto text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold"
                >
                  View full dossier <ArrowRight size={11} />
                </Link>
              )}
            </div>

            {/* Reasons / breakdown */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 col-span-2">
              <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-3 block">Detection Signals</span>
              {analysisResult.reasons?.length > 0 ? (
                <ul className="space-y-2">
                  {analysisResult.reasons.slice(0, 4).map((r: string, i: number) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              ) : analysisResult.risk_breakdown?.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {analysisResult.risk_breakdown.map((item: any) => (
                    <div key={item.feature} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                      <p className="text-slate-500 truncate mb-1">{item.feature}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-900 font-semibold">{item.score}%</span>
                        <span className="text-slate-400 text-[10px]">wt {item.weight}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-xs">No breakdown available.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recent Threats Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-slate-900 font-semibold text-sm">Recent Threats</h3>
            <p className="text-slate-500 text-xs mt-0.5">Latest suspicious domains analyzed</p>
          </div>
          <Link
            to="/threats"
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <ThreatTable threats={threats.length > 0 ? threats.slice(0, 6) : []} />
      </div>

    </div>
  )
}