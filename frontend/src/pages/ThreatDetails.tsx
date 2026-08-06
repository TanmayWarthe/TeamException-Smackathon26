import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Shield, Clock, AlertTriangle, CheckCircle2, Ban, Loader2, Server, Lock, Trash2 } from 'lucide-react'
import { api } from '../services/api'
import RiskBadge from '../components/RiskBadge'
import { useRealtime } from '../context/RealtimeContext'

export default function ThreatDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { updateThreatStatusLocally, deleteThreat } = useRealtime()
  const [threat, setThreat] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
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

  const handleDelete = async () => {
    if (!id || !threat) return
    if (window.confirm(`Are you sure you want to permanently delete the threat record for "${threat.domain}"?`)) {
      setDeleting(true)
      try {
        await deleteThreat(id)
        navigate('/threats')
      } catch (err) {
        console.error('Failed to delete threat:', err)
        setDeleting(false)
      }
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
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  if (!threat) {
    return (
      <div className="p-8 space-y-4 max-w-5xl mx-auto">
        <Link to="/threats" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm w-fit font-medium">
          <ArrowLeft size={16} /> Back to Threats
        </Link>
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
          Threat record not found or an error occurred while loading.
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
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition shadow-xs font-medium"
        >
          <ArrowLeft size={16} /> Back to Threats
        </Link>

        {/* Status & Delete Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleStatusChange('BLOCKED')}
            disabled={statusUpdating || deleting || threat.threat_status === 'BLOCKED'}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer ${
              threat.threat_status === 'BLOCKED'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 shadow-xs'
            }`}
          >
            <Ban size={14} /> Block Domain
          </button>
          <button
            onClick={() => handleStatusChange('RESOLVED')}
            disabled={statusUpdating || deleting || threat.threat_status === 'RESOLVED'}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer ${
              threat.threat_status === 'RESOLVED'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 shadow-xs'
            }`}
          >
            <CheckCircle2 size={14} /> Mark Resolved
          </button>
          <button
            onClick={handleDelete}
            disabled={statusUpdating || deleting}
            title="Delete this threat record"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 shadow-xs cursor-pointer"
          >
            <Trash2 size={14} className="text-red-500" /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Header Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight break-all">{threat.domain}</h1>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full uppercase border ${
                threat.threat_status === 'BLOCKED'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : threat.threat_status === 'RESOLVED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {threat.threat_status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
            <span className="flex items-center gap-1">
              <Globe size={13} className="text-slate-400" /> {threat.url}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={13} className="text-slate-400" /> Detected: {new Date(threat.detected_at).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase font-semibold">Risk Score</p>
            <p className="text-2xl font-black text-slate-900">{threat.risk_score}%</p>
          </div>
          <RiskBadge score={threat.risk_score} />
        </div>
      </div>

      {/* Infrastructure & Intelligence Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-slate-400 text-xs uppercase font-semibold">Targeted Portal</p>
          <p className="text-slate-900 font-bold text-base mt-1 flex items-center gap-2">
            <Shield size={16} className="text-blue-600" /> {threat.targeted_portal || threat.matched_twin?.website_name || 'Protected Campus Portal'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-slate-400 text-xs uppercase font-semibold">Origin IP Address</p>
          <p className="text-slate-900 font-semibold text-sm mt-1 flex items-center gap-2">
            <Server size={16} className="text-slate-400" /> {threat.ip_address || 'Not available'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-slate-400 text-xs uppercase font-semibold">Domain Registrar</p>
          <p className="text-slate-900 font-semibold text-sm mt-1 truncate">
            {threat.registrar || 'Not available'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-slate-400 text-xs uppercase font-semibold">SSL Certificate</p>
          <p className={`font-semibold text-sm mt-1 flex items-center gap-1.5 ${
            (threat.ssl_status || '').startsWith('Valid')
              ? 'text-emerald-700'
              : (threat.ssl_status || '').includes('No SSL')
              ? 'text-amber-700'
              : 'text-slate-600'
          }`}>
            {(threat.ssl_status || '').startsWith('Valid') ? (
              <Lock size={14} />
            ) : (
              <AlertTriangle size={14} className="text-amber-500" />
            )}
            {threat.ssl_status || 'Not available'}
          </p>
        </div>
      </div>

      {/* Visual & DOM Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-900 font-semibold text-sm">Suspicious Candidate Page</h3>
            <span className="text-xs text-red-600 font-semibold">Malicious Clone</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 h-52 flex flex-col justify-between">
            <div className="space-y-1 text-xs">
              <p className="text-slate-600">Captured DOM Title: <strong className="text-slate-900">{threat.evidence?.dom_title || threat.domain}</strong></p>
              <p className="text-slate-600">Action Endpoint: <strong className="text-red-600">{threat.evidence?.action_endpoint || threat.url}</strong></p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200 text-[11px] text-slate-600">
              Screenshot Evidence: {threat.screenshot_path || `evidence/${threat.domain}.png`}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-900 font-semibold text-sm">Official Digital Twin Baseline</h3>
            <span className="text-xs text-emerald-600 font-semibold">Protected Baseline</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 h-52 flex flex-col justify-between">
            <div className="space-y-1 text-xs">
              <p className="text-slate-600">Baseline Domain: <strong className="text-emerald-700">{
                threat.matched_twin?.domain ||
                (threat.matched_twin?.official_url ? new URL(threat.matched_twin.official_url).hostname : '') ||
                (threat.targeted_portal && threat.targeted_portal.includes('.') && !threat.targeted_portal.includes(' ') ? threat.targeted_portal : '') ||
                'Unregistered Digital Twin'
              }</strong></p>
              <p className="text-slate-600">Baseline Name: <strong className="text-slate-900">{
                threat.matched_twin?.website_name ||
                threat.targeted_portal ||
                'Unregistered Digital Twin'
              }</strong></p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200 text-[11px] text-slate-600">
              Screenshot Baseline: {threat.official_screenshot_path || (threat.matched_twin?.domain ? `evidence/${threat.matched_twin.domain}_baseline.png` : 'Not Available')}
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Feature Risk Breakdown */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-slate-900 font-semibold text-base mb-4">Multi-Vector Similarity Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {threat.risk_breakdown?.map((r: any) => (
            <div key={r.feature} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">{r.feature}</span>
                <span className="text-blue-600 font-bold">{r.score}% (wt: {r.weight}%)</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
            <AlertTriangle size={18} /> Threat Assessment Summary
          </div>
          <ul className="space-y-2">
            {threat.explanation?.reasons?.map((r: string, i: number) => (
              <li key={i} className="text-slate-700 text-xs flex items-start gap-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-red-600 font-bold">•</span> {r}
              </li>
            ))}
          </ul>
          <div className="pt-2">
            <p className="text-xs text-slate-400 font-semibold uppercase">Suggested Action:</p>
            <p className="text-sm font-bold text-red-700 mt-0.5">{threat.explanation?.recommendation || 'DO NOT ENTER CREDENTIALS'}</p>
          </div>
        </div>

        {/* Admin Notes & Timeline */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <h3 className="text-slate-900 font-semibold text-sm mb-2">Investigation Notes</h3>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Record investigation notes, registrar abuse contact, or remediation actions..."
              rows={4}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 transition"
            />
            {notesMessage && (
              <p className="text-emerald-700 text-xs mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 size={13} /> {notesMessage}
              </p>
            )}
          </div>
          <button
            onClick={handleSaveNotes}
            disabled={notesSaving}
            className="self-end bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow-xs"
          >
            {notesSaving ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  )
}