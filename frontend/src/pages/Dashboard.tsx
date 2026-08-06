import { useState, useEffect } from 'react'
import { ShieldAlert, AlertTriangle, Users, Fingerprint, Search, Loader2, Shield, ArrowRight, TrendingUp } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { Link } from 'react-router-dom'
import StatCard from '../components/StatCard'
import ThreatTable from '../components/ThreatTable'
import { api } from '../services/api'
import { useRealtime } from '../context/RealtimeContext'

const PIE_COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#f97316', '#ef4444']

const RISK_BADGE: Record<string, string> = {
  TRUSTED:    'bg-emerald-500/15 text-emerald-400',
  LOW:        'bg-sky-500/15 text-sky-400',
  SUSPICIOUS: 'bg-amber-500/15 text-amber-400',
  HIGH:       'bg-orange-500/15 text-orange-400',
  CRITICAL:   'bg-red-500/15 text-red-400',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-bold">{payload[0].value} detections</p>
    </div>
  )
}

export default function Dashboard() {
  const { threats, isConnected } = useRealtime()
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
  const [analytics, setAnalytics] = useState<any>(null)

  const [inspectUrl, setInspectUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [inspectError, setInspectError] = useState<string | null>(null)

  useEffect(() => {
    api.getDashboardStats().then((data) => { if (data) setStats(data) })
    api.getStatistics().then((data) => { if (data) setAnalytics(data) })
  }, [])

  const criticalCount = threats.length > 0 ? threats.filter((t) => t.risk_score >= 90).length : stats.critical
  const totalCount    = threats.length > 0 ? threats.length : stats.total_threats

  const handleInspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inspectUrl.trim()) return
    setAnalyzing(true)
    setInspectError(null)
    setAnalysisResult(null)
    try {
      const result = await api.analyzeUrl(inspectUrl.trim())
      setAnalysisResult(result)
    } catch (err: any) {
      setInspectError(err?.message || 'Failed to analyze URL')
    } finally {
      setAnalyzing(false)
    }
  }

  const riskPieData = analytics?.risk_distribution || [
    { name: 'Trusted',    value: stats.trusted },
    { name: 'Low',        value: stats.low },
    { name: 'Suspicious', value: stats.suspicious },
    { name: 'High',       value: stats.high },
    { name: 'Critical',   value: criticalCount },
  ]

  const lineChartData = analytics?.threats_over_time || [
    { date: 'Jul 28', count: 4 },
    { date: 'Jul 29', count: 7 },
    { date: 'Jul 30', count: 3 },
    { date: 'Jul 31', count: 9 },
    { date: 'Aug 1',  count: 12 },
    { date: 'Aug 2',  count: 6 },
    { date: 'Aug 3',  count: 10 },
  ]

  const scoreColor =
    analysisResult?.risk_score >= 90 ? 'text-red-400'
    : analysisResult?.risk_score >= 70 ? 'text-orange-400'
    : analysisResult?.risk_score >= 50 ? 'text-amber-400'
    : 'text-emerald-400'

  return (
    <div className="p-6 md:p-8 space-y-7 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Campus threat intelligence — real-time analysis &amp; digital twin monitoring
          </p>
        </div>
        <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${
          isConnected
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          {isConnected ? 'Live feed active' : 'Reconnecting…'}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Threats"
          value={totalCount}
          icon={ShieldAlert}
          accentColor="text-slate-300"
          iconBg="bg-slate-800"
          trend="Indexed"
        />
        <StatCard
          label="Critical Active"
          value={criticalCount}
          icon={AlertTriangle}
          accentColor="text-red-400"
          iconBg="bg-red-500/10"
          trend={criticalCount > 0 ? '⚠ Needs attention' : 'All clear'}
        />
        <StatCard
          label="Students Protected"
          value={stats.students_protected}
          icon={Users}
          accentColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          trend="This session"
        />
        <StatCard
          label="Digital Twins"
          value={stats.digital_twins}
          icon={Fingerprint}
          accentColor="text-sky-400"
          iconBg="bg-sky-500/10"
          trend="Fingerprinted"
        />
      </div>

      {/* AI Inspector */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold text-base">AI Site Inspector</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Paste any suspicious URL to run a live multi-vector threat analysis
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Shield size={17} className="text-indigo-400" />
          </div>
        </div>

        <form onSubmit={handleInspectSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              type="text"
              value={inspectUrl}
              onChange={(e) => setInspectUrl(e.target.value)}
              placeholder="https://suspicious-domain.xyz/login"
              className="w-full bg-slate-950 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition"
              disabled={analyzing}
            />
          </div>
          <button
            type="submit"
            disabled={analyzing || !inspectUrl.trim()}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition shrink-0"
          >
            {analyzing ? (
              <><Loader2 className="animate-spin" size={15} /> Analyzing…</>
            ) : (
              <><Shield size={15} /> Analyze</>
            )}
          </button>
        </form>

        {inspectError && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
            {inspectError}
          </div>
        )}

        {analysisResult && (
          <div className="mt-5 pt-5 border-t border-slate-800/60 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Score */}
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-4 flex flex-col gap-3">
              <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Risk Score</span>
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
              <p className="text-xs text-slate-500">
                Action: <span className="text-slate-300 font-medium">{analysisResult.recommendation}</span>
              </p>
              {analysisResult.threat_id && (
                <Link
                  to={`/threats/${analysisResult.threat_id}`}
                  className="mt-auto text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                >
                  View full dossier <ArrowRight size={11} />
                </Link>
              )}
            </div>

            {/* Reasons / breakdown */}
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-4 col-span-2">
              <span className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3 block">Detection Signals</span>
              {analysisResult.reasons?.length > 0 ? (
                <ul className="space-y-2">
                  {analysisResult.reasons.slice(0, 4).map((r: string, i: number) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              ) : analysisResult.risk_breakdown?.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {analysisResult.risk_breakdown.map((item: any) => (
                    <div key={item.feature} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs">
                      <p className="text-slate-400 truncate mb-1">{item.feature}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-white font-semibold">{item.score}%</span>
                        <span className="text-slate-600 text-[10px]">wt {item.weight}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-xs">No breakdown available.</p>
              )}
            </div>
          </div>
        )}
      </div>

      

      {/* Recent Threats Table */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold text-sm">Recent Threats</h3>
            <p className="text-slate-500 text-xs mt-0.5">Latest suspicious domains analyzed</p>
          </div>
          <Link
            to="/threats"
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <ThreatTable threats={threats.length > 0 ? threats.slice(0, 6) : []} />
      </div>

    </div>
  )
}