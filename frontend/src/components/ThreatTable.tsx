import { useNavigate } from 'react-router-dom'
import type { Threat } from '../types'
import RiskBadge from './RiskBadge'

export default function ThreatTable({ threats }: { threats: Threat[] }) {
  const navigate = useNavigate()

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-left">
            <th className="px-4 py-3 font-medium">Domain</th>
            <th className="px-4 py-3 font-medium">Targeted Portal</th>
            <th className="px-4 py-3 font-medium">Risk</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Detected</th>
          </tr>
        </thead>
        <tbody>
          {threats.map((t) => (
            <tr
              key={t.id}
              onClick={() => navigate(`/threats/${t.id}`)}
              className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition"
            >
              <td className="px-4 py-3 text-slate-900 font-medium">{t.domain}</td>
              <td className="px-4 py-3 text-slate-700">{t.targeted_portal}</td>
              <td className="px-4 py-3"><RiskBadge score={t.risk_score} /></td>
              <td className="px-4 py-3 text-slate-700">{t.threat_status}</td>
              <td className="px-4 py-3 text-slate-400">{new Date(t.detected_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}