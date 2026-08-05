import { useState, useEffect } from 'react'
import { Fingerprint, Plus, Loader2, Globe, CheckCircle2 } from 'lucide-react'
import { api } from '../services/api'
import type { DigitalTwin } from '../services/mockData'
import Modal from '../components/Modal'

export default function DigitalTwins() {
  const [twins, setTwins] = useState<DigitalTwin[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [websiteName, setWebsiteName] = useState('')
  const [officialUrl, setOfficialUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchTwins = async () => {
    setLoading(true)
    try {
      const data = await api.getDigitalTwins()
      setTwins(data)
    } catch (err) {
      console.error('Failed to load twins:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTwins()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await api.createDigitalTwin(websiteName, officialUrl)
      setSuccess(`Digital Twin created for ${websiteName}!`)
      setWebsiteName('')
      setOfficialUrl('')
      await fetchTwins()
      setTimeout(() => {
        setIsModalOpen(false)
        setSuccess(null)
      }, 1500)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create digital twin. Please check URL.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Digital Twin Manager</h1>
          <p className="text-slate-400 text-sm mt-1">
            Registered baseline visual & structural fingerprints for campus websites
          </p>
        </div>
        <button
          onClick={() => {
            setError(null)
            setSuccess(null)
            setIsModalOpen(true)
          }}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg px-4 py-2 text-sm transition"
        >
          <Plus size={16} /> Register New Portal
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-cyan-400" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {twins.map((dt) => (
            <div key={dt.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Fingerprint className="text-cyan-400" size={20} />
                  </div>
                  <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2.5 py-1 rounded-full font-medium">
                    v{dt.fingerprint_version}
                  </span>
                </div>
                <h3 className="text-white font-semibold text-lg">{dt.website_name}</h3>
                <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1.5 break-all">
                  <Globe size={13} className="shrink-0 text-slate-500" />
                  <a href={dt.official_url} target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition">
                    {dt.official_url}
                  </a>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                <span>Active Protection</span>
                <span>{new Date(dt.updated_at || dt.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => !submitting && setIsModalOpen(false)} title="Register Official Portal">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-lg flex items-center gap-2">
              <CheckCircle2 size={16} /> {success}
            </div>
          )}
          <div>
            <label className="block text-slate-400 text-sm mb-1 font-medium">Website Name</label>
            <input
              type="text"
              value={websiteName}
              onChange={(e) => setWebsiteName(e.target.value)}
              placeholder="e.g. YCCE Official Website"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-500 transition text-sm"
              disabled={submitting}
              required
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1 font-medium">Official URL</label>
            <input
              type="url"
              value={officialUrl}
              onChange={(e) => setOfficialUrl(e.target.value)}
              placeholder="https://www.ycce.edu"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-500 transition text-sm"
              disabled={submitting}
              required
            />
            <p className="text-slate-500 text-xs mt-1">
              Playwright will launch headless Chrome, take a screenshot, and extract DOM + CLIP neural embeddings.
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold rounded-lg py-2.5 transition text-sm mt-2"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Capturing & Generating Twin (10-20s)...
              </>
            ) : (
              'Generate Digital Twin'
            )}
          </button>
        </form>
      </Modal>
    </div>
  )
}