import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { mockThreatDetail } from '../services/mockData'
import RiskBadge from '../components/RiskBadge'

export default function ThreatDetails() {
  const { id } = useParams()
  // For now uses the single mock detail regardless of id — swap with real API call by id later
  const t = mockThreatDetail

  return (
    <div className="p-8 space-y-6">
      <Link to="/threats" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm w-fit">
        <ArrowLeft size={16} /> Back to Threats
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.domain}</h1>
          <p className="text-slate-500 text-sm">Threat ID: {id}</p>
        </div>
        <RiskBadge score={t.risk_score} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm mb-2">Suspicious Website</p>
          <div className="bg-slate-800 rounded-lg h-48 flex items-center justify-center text-slate-500 text-xs">
            Screenshot: {t.screenshot_path}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm mb-2">Official Digital Twin</p>
          <div className="bg-slate-800 rounded-lg h-48 flex items-center justify-center text-slate-500 text-xs">
            Screenshot: {t.official_screenshot_path}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-medium mb-4">Risk Breakdown</h3>
        <div className="space-y-2">
          {t.risk_breakdown.map((r) => (
            <div key={r.feature} className="flex items-center gap-3 text-sm">
              <span className="w-40 text-slate-400">{r.feature}</span>
              <div className="flex-1 bg-slate-800 rounded-full h-2">
                <div className="bg-cyan-500 h-2 rounded-full" style={{ width: `${r.score}%` }} />
              </div>
              <span className="w-12 text-right text-white">{r.score}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-medium mb-3">AI Explanation</h3>
        <ul className="space-y-1.5">
          {t.explanation.reasons.map((r, i) => (
            <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
              <span className="text-red-400">•</span> {r}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-red-400 font-medium text-sm">Recommendation: {t.explanation.recommendation}</p>
      </div>
    </div>
  )
}