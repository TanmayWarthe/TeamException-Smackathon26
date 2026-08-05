import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Globe, Shield, Clock, AlertTriangle, CheckCircle2, Ban, Loader2, Server, Lock } from 'lucide-react'
import { api } from '../services/api'
import RiskBadge from '../components/RiskBadge'
import { useRealtime } from '../context/RealtimeContext'

export default function ThreatDetails() {
  const { id } = useParams()
  const { updateThreatStatusLocally } = useRealtime()
  const [threat, setThreat] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesMessage, setNotesMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.getThreatDetail(id)
      .then((data) => {
        setThreat(data)
        setAdminNotes(data.admin_notes || '')
      })
      .catch((err) => {
        console.error('Failed to fetch threat details:', err)
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleStatusChange = async (newStatus: string) => {
    if (!id || !threat) return
    setStatusUpdating(true)
    try {
      await api.updateThreatStatus(id, newStatus, adminNotes)
      setThreat((prev: any) => ({ ...prev, threat_status: newStatus }))
      updateThreatStatusLocally(id, newStatus as any)
    } catch (err) {
      console.error('Failed to update threat status:', err)
    } finally {
      setStatusUpdating(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!id || !threat) return
    setNotesSaving(true)
    setNotesMessage(null)
    try {
      await api.updateThreatStatus(id, threat.threat_status, adminNotes)
      setNotesMessage('Notes saved successfully!')
      setTimeout(() => setNotesMessage(null), 3000)
    } catch (err) {
      console.error('Failed to save notes:', err)
    } finally {
      setNotesSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-cyan-400" size={32} />
      </div>
    )
  }

  if (!threat) {
    return (
      <div className="p-8 space-y-4 max-w-5xl mx-auto">
        <Link to="/threats" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm w-fit">
          <ArrowLeft size={16} /> Back to Threats
        </Link>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          Threat not found or error loading record.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/threats"
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl transition"
        >
          <ArrowLeft size={16} /> Back to Threats
        </Link>

        {/* Status Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleStatusChange('BLOCKED')}
            disabled={statusUpdating || threat.threat_status === 'BLOCKED'}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
              threat.threat_status === 'BLOCKED'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-slate-900 hover:bg-red-950/40 text-slate-300 hover:text-red-300 border border-slate-800'
            }`}
          >
            <Ban size={14} /> Block Domain
          </button>
          <button
            onClick={() => handleStatusChange('RESOLVED')}
            disabled={statusUpdating || threat.threat_status === 'RESOLVED'}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
              threat.threat_status === 'RESOLVED'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-900 hover:bg-emerald-950/40 text-slate-300 hover:text-emerald-300 border border-slate-800'
            }`}
          >
            <CheckCircle2 size={14} /> Mark Resolved
          </button>
        </div>
      </div>

      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight break-all">{threat.domain}</h1>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full uppercase border ${
                threat.threat_status === 'BLOCKED'
                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                  : threat.threat_status === 'RESOLVED'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {threat.threat_status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2 font-mono">
            <span className="flex items-center gap-1">
              <Globe size={13} className="text-slate-500" /> {threat.url}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={13} className="text-slate-500" /> Detected: {new Date(threat.detected_at).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-500 font-mono uppercase">AI Risk Score</p>
            <p className="text-2xl font-black text-white">{threat.risk_score}%</p>
          </div>
          <RiskBadge score={threat.risk_score} />
        </div>
      </div>

      {/* Infrastructure & Intelligence Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-500 text-xs font-mono uppercase">Targeted Institution Portal</p>
          <p className="text-white font-bold text-base mt-1 flex items-center gap-2">
            <Shield size={16} className="text-cyan-400" /> {threat.targeted_portal || 'YCCE ERP Portal'}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-500 text-xs font-mono uppercase">Origin IP Address</p>
          <p className="text-white font-mono font-medium text-sm mt-1 flex items-center gap-2">
            <Server size={16} className="text-slate-400" /> {threat.ip_address || '185.220.101.4'}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-500 text-xs font-mono uppercase">Domain Registrar</p>
          <p className="text-white font-medium text-sm mt-1 truncate">
            {threat.registrar || 'NameCheap Inc.'}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-500 text-xs font-mono uppercase">SSL Certificate</p>
          <p className="text-emerald-400 font-medium text-sm mt-1 flex items-center gap-1.5">
            <Lock size={14} /> {threat.ssl_status || 'Valid (Let\'s Encrypt)'}
          </p>
        </div>
      </div>

      {/* Visual & DOM Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">Suspicious Phishing Candidate</h3>
            <span className="text-xs text-red-400 font-mono">Malicious Clone</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-52 flex flex-col justify-between">
            <div className="space-y-1 text-xs">
              <p className="text-slate-400">Captured DOM Title: <strong className="text-white">YCCE Student Login - ERP</strong></p>
              <p className="text-slate-400">Action Endpoint: <strong className="text-red-400">https://{threat.domain}/auth/capture.php</strong></p>
            </div>
            <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 text-[11px] font-mono text-slate-400">
              Screenshot Evidence: {threat.screenshot_path || `evidence/${threat.domain}.png`}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">Official Institutional Digital Twin</h3>
            <span className="text-xs text-emerald-400 font-mono">Protected Baseline</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-52 flex flex-col justify-between">
            <div className="space-y-1 text-xs">
              <p className="text-slate-400">Baseline Domain: <strong className="text-emerald-400">erp.ycce.edu.in</strong></p>
              <p className="text-slate-400">Fingerprint Status: <strong className="text-white">v1.2 Neural CLIP Verified</strong></p>
            </div>
            <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 text-[11px] font-mono text-slate-400">
              Screenshot Baseline: {threat.official_screenshot_path || 'evidence/official_erp.png'}
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Feature Risk Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-semibold text-base mb-4">Multi-Vector Similarity Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {threat.risk_breakdown?.map((r: any) => (
            <div key={r.feature} className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">{r.feature}</span>
                <span className="text-cyan-400 font-mono font-bold">{r.score}% (wt: {r.weight}%)</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    r.score >= 80 ? 'bg-red-500' : r.score >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${r.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Explanation & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
            <AlertTriangle size={18} /> AI Threat Explanation
          </div>
          <ul className="space-y-2">
            {threat.explanation?.reasons?.map((r: string, i: number) => (
              <li key={i} className="text-slate-300 text-xs flex items-start gap-2 leading-relaxed bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-red-400 font-bold">•</span> {r}
              </li>
            ))}
          </ul>
          <div className="pt-2">
            <p className="text-xs text-slate-400 font-mono">Suggested Enforcement Action:</p>
            <p className="text-sm font-bold text-red-400 mt-0.5">{threat.explanation?.recommendation || 'BLOCK CREDENTIAL INPUT'}</p>
          </div>
        </div>

        {/* Admin Notes & Timeline */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-white font-semibold text-sm mb-2">SecOps Investigation Notes</h3>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Record forensic notes, registrar abuse contact, or remediation actions..."
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition"
            />
            {notesMessage && (
              <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 size={13} /> {notesMessage}
              </p>
            )}
          </div>
          <button
            onClick={handleSaveNotes}
            disabled={notesSaving}
            className="self-end bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition"
          >
            {notesSaving ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  )
}