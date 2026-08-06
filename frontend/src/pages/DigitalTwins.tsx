import { useState, useEffect, useMemo } from 'react'
import {
  Fingerprint,
  Plus,
  Loader2,
  Globe,
  CheckCircle2,
  Edit2,
  Trash2,
  RefreshCw,
  ExternalLink,
  Search,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { api } from '../services/api'
import type { DigitalTwin } from '../types'
import Modal from '../components/Modal'

export default function DigitalTwins() {
  const [twins, setTwins] = useState<DigitalTwin[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createWebsiteName, setCreateWebsiteName] = useState('')
  const [createOfficialUrl, setCreateOfficialUrl] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingTwin, setEditingTwin] = useState<DigitalTwin | null>(null)
  const [editWebsiteName, setEditWebsiteName] = useState('')
  const [editOfficialUrl, setEditOfficialUrl] = useState('')
  const [editRegenerateFp, setEditRegenerateFp] = useState(true)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingTwin, setDeletingTwin] = useState<DigitalTwin | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Quick Action State
  const [reSyncingId, setReSyncingId] = useState<string | null>(null)
  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setActionToast({ message, type })
    setTimeout(() => setActionToast(null), 3500)
  }

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

  // Filter twins based on search
  const filteredTwins = useMemo(() => {
    if (!searchQuery.trim()) return twins
    const q = searchQuery.toLowerCase()
    return twins.filter(
      (t) =>
        t.website_name.toLowerCase().includes(q) ||
        t.official_url.toLowerCase().includes(q)
    )
  }, [twins, searchQuery])

  // ── Handle Register New Twin ────────────────────────────────
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateSubmitting(true)
    setCreateError(null)
    setCreateSuccess(null)
    try {
      await api.createDigitalTwin(createWebsiteName, createOfficialUrl)
      setCreateSuccess(`Digital Twin created for "${createWebsiteName}"!`)
      setCreateWebsiteName('')
      setCreateOfficialUrl('')
      await fetchTwins()
      setTimeout(() => {
        setIsCreateModalOpen(false)
        setCreateSuccess(null)
      }, 1200)
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail || 'Failed to create digital twin. Please check URL.')
    } finally {
      setCreateSubmitting(false)
    }
  }

  // ── Open Edit Modal ─────────────────────────────────────────
  const openEditModal = (twin: DigitalTwin) => {
    setEditingTwin(twin)
    setEditWebsiteName(twin.website_name)
    setEditOfficialUrl(twin.official_url)
    setEditRegenerateFp(false)
    setEditError(null)
    setEditSuccess(null)
    setIsEditModalOpen(true)
  }

  // ── Handle Edit Submit ──────────────────────────────────────
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTwin) return
    setEditSubmitting(true)
    setEditError(null)
    setEditSuccess(null)

    try {
      const updated = await api.updateDigitalTwin(editingTwin.id, {
        website_name: editWebsiteName,
        official_url: editOfficialUrl,
        regenerate_fingerprint: editRegenerateFp || editOfficialUrl !== editingTwin.official_url,
      })

      setEditSuccess(`Updated "${updated.website_name}" successfully!`)
      await fetchTwins()
      setTimeout(() => {
        setIsEditModalOpen(false)
        setEditSuccess(null)
        setEditingTwin(null)
      }, 1000)
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || 'Failed to update digital twin.')
    } finally {
      setEditSubmitting(false)
    }
  }

  // ── Open Delete Modal ───────────────────────────────────────
  const openDeleteModal = (twin: DigitalTwin) => {
    setDeletingTwin(twin)
    setDeleteError(null)
    setIsDeleteModalOpen(true)
  }

  // ── Handle Delete ───────────────────────────────────────────
  const handleDeleteSubmit = async () => {
    if (!deletingTwin) return
    setDeleteSubmitting(true)
    setDeleteError(null)
    try {
      await api.deleteDigitalTwin(deletingTwin.id)
      showToast(`Digital Twin "${deletingTwin.website_name}" removed.`, 'success')
      setIsDeleteModalOpen(false)
      setDeletingTwin(null)
      await fetchTwins()
    } catch (err: any) {
      setDeleteError(err?.response?.data?.detail || 'Failed to delete digital twin.')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  // ── Quick Re-Sync Fingerprint ───────────────────────────────
  const handleQuickReSync = async (twin: DigitalTwin) => {
    setReSyncingId(twin.id)
    try {
      await api.updateDigitalTwin(twin.id, {
        regenerate_fingerprint: true,
      })
      showToast(`Baseline fingerprint for "${twin.website_name}" refreshed (v${(twin.fingerprint_version || 1) + 1})!`, 'success')
      await fetchTwins()
    } catch (err: any) {
      showToast(`Failed to refresh fingerprint: ${err?.message || 'Error'}`, 'error')
    } finally {
      setReSyncingId(null)
    }
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {actionToast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            actionToast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {actionToast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {actionToast.message}
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Digital Twin Manager</h1>
            <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">
              {twins.length} Protected
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Registered baseline visual, DOM &amp; structural fingerprints for campus websites.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search portals or domains..."
              className="bg-white border border-slate-300 focus:border-blue-500 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none w-64 transition"
            />
          </div>

          <button
            onClick={() => {
              setCreateError(null)
              setCreateSuccess(null)
              setIsCreateModalOpen(true)
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2 text-sm transition shadow-xs"
          >
            <Plus size={16} /> Register New Portal
          </button>
        </div>
      </div>

      {/* Main Grid Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-blue-600" size={36} />
        </div>
      ) : filteredTwins.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <Fingerprint className="mx-auto text-slate-400 mb-3" size={44} />
          <h3 className="text-slate-900 font-semibold text-base">No Digital Twins Found</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
            {searchQuery ? `No twins matching "${searchQuery}"` : 'Register your first institutional portal to start monitoring.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTwins.map((dt) => {
            const isSyncing = reSyncingId === dt.id
            return (
              <div
                key={dt.id}
                className="group relative bg-white hover:border-slate-300 border border-slate-200 rounded-xl p-5 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Icon, Version, Action Buttons */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                        <Fingerprint size={20} />
                      </div>
                      <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-md font-semibold border border-blue-100">
                        v{dt.fingerprint_version}
                      </span>
                    </div>

                    {/* Action Buttons: Quick Sync, Edit, Delete */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleQuickReSync(dt)}
                        disabled={isSyncing}
                        title="Re-fingerprint & capture latest baseline"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition"
                      >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin text-blue-600' : ''} />
                      </button>

                      <button
                        onClick={() => openEditModal(dt)}
                        title="Edit Portal Details"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition"
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        onClick={() => openDeleteModal(dt)}
                        title="Remove Digital Twin"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Title & URL */}
                  <h3 className="text-slate-900 font-semibold text-lg group-hover:text-blue-600 transition-colors">
                    {dt.website_name}
                  </h3>

                  <div className="flex items-center gap-1.5 text-slate-600 text-xs mt-2 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200">
                    <Globe size={13} className="shrink-0 text-blue-500" />
                    <a
                      href={dt.official_url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-blue-600 transition truncate max-w-[240px]"
                    >
                      {dt.official_url}
                    </a>
                    <ExternalLink size={11} className="shrink-0 text-slate-400 ml-auto" />
                  </div>
                </div>

                {/* Footer Status */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <ShieldCheck size={14} className="text-emerald-600" />
                    Active Protection
                  </div>
                  <span className="text-slate-400">
                    {new Date(dt.updated_at || dt.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal: Register New Portal ────────────────────────── */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !createSubmitting && setIsCreateModalOpen(false)}
        title="Register Official Portal"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" /> {createError}
            </div>
          )}
          {createSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-lg flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" /> {createSuccess}
            </div>
          )}
          <div>
            <label className="block text-slate-700 text-sm mb-1.5 font-medium">Website / Portal Name</label>
            <input
              type="text"
              value={createWebsiteName}
              onChange={(e) => setCreateWebsiteName(e.target.value)}
              placeholder="e.g. YCCE Examination Portal"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:border-blue-500 transition text-sm"
              disabled={createSubmitting}
              required
            />
          </div>
          <div>
            <label className="block text-slate-700 text-sm mb-1.5 font-medium">Official URL</label>
            <input
              type="url"
              value={createOfficialUrl}
              onChange={(e) => setCreateOfficialUrl(e.target.value)}
              placeholder="https://exam.ycce.edu"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:border-blue-500 transition text-sm"
              disabled={createSubmitting}
              required
            />
            <p className="text-slate-500 text-xs mt-1.5">
              Headless browser will capture visual screenshots, DOM tree, and structural embeddings to establish the baseline.
            </p>
          </div>
          <button
            type="submit"
            disabled={createSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition text-sm mt-2 shadow-xs"
          >
            {createSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Capturing &amp; Generating Baseline (5-10s)...
              </>
            ) : (
              'Generate Digital Twin'
            )}
          </button>
        </form>
      </Modal>

      {/* ── Modal: Edit Existing Digital Twin ──────────────────── */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !editSubmitting && setIsEditModalOpen(false)}
        title="Edit Digital Twin"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {editError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" /> {editError}
            </div>
          )}
          {editSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-lg flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" /> {editSuccess}
            </div>
          )}

          <div>
            <label className="block text-slate-700 text-sm mb-1.5 font-medium">Website / Portal Name</label>
            <input
              type="text"
              value={editWebsiteName}
              onChange={(e) => setEditWebsiteName(e.target.value)}
              placeholder="e.g. YCCE Official Website"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:border-blue-500 transition text-sm"
              disabled={editSubmitting}
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 text-sm mb-1.5 font-medium">Official Base URL / Domain</label>
            <input
              type="url"
              value={editOfficialUrl}
              onChange={(e) => setEditOfficialUrl(e.target.value)}
              placeholder="https://www.ycce.edu"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:border-blue-500 transition text-sm"
              disabled={editSubmitting}
              required
            />
            <p className="text-slate-500 text-xs mt-1.5">
              Change the URL or domain anytime the official portal moves or updates its address.
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-start gap-3">
            <input
              type="checkbox"
              id="regen-fp-checkbox"
              checked={editRegenerateFp}
              onChange={(e) => setEditRegenerateFp(e.target.checked)}
              className="mt-1 rounded bg-white border-slate-300 text-blue-600 focus:ring-0 focus:outline-none"
              disabled={editSubmitting}
            />
            <label htmlFor="regen-fp-checkbox" className="text-xs text-slate-600 cursor-pointer">
              <span className="font-semibold text-slate-900 block">Re-Capture Fingerprint Baseline</span>
              Re-scan and refresh DOM structure, login form fields, and screenshot embeddings for this URL.
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              disabled={editSubmitting}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg py-2.5 transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSubmitting}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition text-sm shadow-xs"
            >
              {editSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Saving Changes...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Delete Confirmation ─────────────────────────── */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !deleteSubmitting && setIsDeleteModalOpen(false)}
        title="Delete Digital Twin"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" /> {deleteError}
            </div>
          )}

          <p className="text-slate-700 text-sm">
            Are you sure you want to remove the Digital Twin for{' '}
            <strong className="text-slate-900 font-semibold">"{deletingTwin?.website_name}"</strong>?
          </p>
          <p className="text-slate-500 text-xs">
            Removing this twin will disable automated visual similarity matching against fake phishing portals for{' '}
            <span className="text-slate-700 underline">{deletingTwin?.official_url}</span>.
          </p>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={deleteSubmitting}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg py-2.5 transition text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteSubmit}
              disabled={deleteSubmitting}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition text-sm shadow-xs"
            >
              {deleteSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Removing...
                </>
              ) : (
                'Confirm Delete'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}