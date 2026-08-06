import { useNavigate } from 'react-router-dom'
import type { Threat } from '../types'
import RiskBadge from './RiskBadge'

export default function ThreatTable({ threats }: { threats: Threat[] }) {
  const navigate = useNavigate()

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 text-left">
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
              className="border-b border-slate-800/50 hover:bg-slate-800/40 cursor-pointer transition"
            >
              <td className="px-4 py-3 text-white">{t.domain}</td>
              <td className="px-4 py-3 text-slate-300">{t.targeted_portal}</td>
              <td className="px-4 py-3"><RiskBadge score={t.risk_score} /></td>
              <td className="px-4 py-3 text-slate-300">{t.threat_status}</td>
              <td className="px-4 py-3 text-slate-500">{new Date(t.detected_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}