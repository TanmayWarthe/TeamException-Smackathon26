import { useState, useEffect } from 'react'
import { ShieldAlert, AlertTriangle, Users, Fingerprint, Search, Sparkles, Loader2, Shield, ArrowRight } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import { Link } from 'react-router-dom'
import StatCard from '../components/StatCard'
import ThreatTable from '../components/ThreatTable'
import { api } from '../services/api'
import { useRealtime } from '../context/RealtimeContext'

const COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#f97316', '#ef4444']

export default function Dashboard() {
  const { threats, isConnected } = useRealtime()
  const [stats, setStats] = useState({
    total_threats: 125,
    critical: 8,
    high: 12,
    suspicious: 21,
    low: 34,
    trusted: 50,
    students_protected: 842,
    credential_blocks: 43,
    digital_twins: 5,
    average_risk_score: 62.4,
  })
  const [analytics, setAnalytics] = useState<any>(null)
  
  // Real-time URL inspector state
  const [inspectUrl, setInspectUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [inspectError, setInspectError] = useState<string | null>(null)

  useEffect(() => {
    api.getDashboardStats().then((data) => {
      if (data) setStats(data)
    })
    api.getStatistics().then((data) => {
      if (data) setAnalytics(data)
    })
  }, [])

  // Dynamically calculate live threat counts if threats are available
  const criticalCount = threats.length > 0 ? threats.filter((t) => t.risk_score >= 90).length : stats.critical
  const totalCount = threats.length > 0 ? threats.length : stats.total_threats

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
    { name: 'Trusted', value: stats.trusted },
    { name: 'Low', value: stats.low },
    { name: 'Suspicious', value: stats.suspicious },
    { name: 'High', value: stats.high },
    { name: 'Critical', value: criticalCount },
  ]

  const lineChartData = analytics?.threats_over_time || [
    { date: '2026-07-28', count: 4 },
    { date: '2026-07-29', count: 7 },
    { date: '2026-07-30', count: 3 },
    { date: '2026-07-31', count: 9 },
    { date: '2026-08-01', count: 12 },
    { date: '2026-08-02', count: 6 },
    { date: '2026-08-03', count: 10 },
  ]

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Welcome & System Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security Operations Command</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Real-time phishing detection, institutional digital twin monitoring, and zero-day protection
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-slate-300 font-mono font-medium">
              {isConnected ? 'Real-Time Pipeline: ACTIVE' : 'Connecting to Socket...'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Threats Indexed" value={totalCount} icon={ShieldAlert} />
        <StatCard label="Critical Active Threats" value={criticalCount} icon={AlertTriangle} accentColor="text-red-500" />
        <StatCard label="Students Protected" value={stats.students_protected} icon={Users} accentColor="text-emerald-400" />
        <StatCard label="Active Digital Twins" value={stats.digital_twins} icon={Fingerprint} />
      </div>

      {/* Real-Time AI Live Inspector Box */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base">Real-Time Threat Intelligence & AI Inspector</h3>
              <p className="text-slate-400 text-xs">Test any suspect domain or phishing candidate against institutional fingerprints</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleInspectSubmit} className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
            <input
              type="text"
              value={inspectUrl}
              onChange={(e) => setInspectUrl(e.target.value)}
              placeholder="Enter suspicious URL (e.g. http://ycce-erp-login.xyz/student_portal)..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition"
              disabled={analyzing}
            />
          </div>
          <button
            type="submit"
            disabled={analyzing || !inspectUrl.trim()}
            className="flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-sm transition shrink-0"
          >
            {analyzing ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Analyzing Multi-Vectors...
              </>
            ) : (
              <>
                <Shield size={16} />
                Run AI Analysis
              </>
            )}
          </button>
        </form>

        {inspectError && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            {inspectError}
          </div>
        )}

        {/* Live Inspector Result View */}
        {analysisResult && (
          <div className="mt-5 pt-5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-500 font-mono uppercase">Verdict & Risk Score</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-3xl font-extrabold text-white">
                    {analysisResult.risk_score}%
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                      analysisResult.risk_score >= 90
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : analysisResult.risk_score >= 70
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {analysisResult.risk_level || analysisResult.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Recommendation: <strong className="text-cyan-400">{analysisResult.recommendation}</strong>
                </p>
              </div>
              {analysisResult.threat_id && (
                <Link
                  to={`/threats/${analysisResult.threat_id}`}
                  className="mt-3 text-xs text-cyan-400 hover:underline flex items-center gap-1 font-medium"
                >
                  View Threat Dossier <ArrowRight size={12} />
                </Link>
              )}
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 col-span-2">
              <span className="text-xs text-slate-500 font-mono uppercase mb-2 block">Feature Similarity Breakdown</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {analysisResult.risk_breakdown?.map((item: any) => (
                  <div key={item.feature} className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/80 text-xs">
                    <p className="text-slate-400 truncate">{item.feature}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-white font-semibold">{item.score}%</span>
                      <span className="text-[10px] text-slate-500">wt: {item.weight}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-base">Risk Distribution</h3>
            <span className="text-xs text-slate-500 font-mono">Live Aggregation</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={riskPieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={4}>
                {riskPieData.map((_entry: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 text-xs mt-2">
            {riskPieData.map((entry: any, i: number) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-slate-400">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-base">Threat Detections Over Time</h3>
            <span className="text-xs text-slate-500 font-mono">Past 7 Days</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={lineChartData}>
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2.5} dot={{ fill: '#06b6d4', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live Recent Threats Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold text-base">Live Threat Stream</h3>
            <p className="text-slate-400 text-xs">Recent suspicious domain candidates analyzed across campus network</p>
          </div>
          <Link
            to="/threats"
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20 transition"
          >
            View All Threats <ArrowRight size={13} />
          </Link>
        </div>
        <ThreatTable threats={threats.length > 0 ? threats.slice(0, 6) : []} />
      </div>
    </div>
  )
}