import { ShieldAlert, AlertTriangle, Users, Fingerprint } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import StatCard from '../components/StatCard'
import ThreatTable from '../components/ThreatTable'
import { mockDashboardStats, mockAnalytics, mockThreats } from '../services/mockData'

const COLORS = ['#4ade80', '#facc15', '#fb923c', '#f87171', '#ef4444']

export default function Dashboard() {
  const stats = mockDashboardStats

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Threats" value={stats.total_threats} icon={ShieldAlert} />
        <StatCard label="Critical" value={stats.critical} icon={AlertTriangle} accentColor="text-red-500" />
        <StatCard label="Students Protected" value={stats.students_protected} icon={Users} accentColor="text-green-400" />
        <StatCard label="Digital Twins" value={stats.digital_twins} icon={Fingerprint} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={mockAnalytics.risk_distribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {mockAnalytics.risk_distribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Threats Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={mockAnalytics.threats_over_time}>
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
              <Line type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-white font-medium mb-3">Recent Threats</h3>
        <ThreatTable threats={mockThreats} />
      </div>
    </div>
  )
}