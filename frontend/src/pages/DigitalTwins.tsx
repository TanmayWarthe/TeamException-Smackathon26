import { useState } from 'react'
import { Fingerprint, Plus } from 'lucide-react'
import { mockDigitalTwins } from '../services/mockData'
import Modal from '../components/Modal'

export default function DigitalTwins() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [websiteName, setWebsiteName] = useState('')
  const [officialUrl, setOfficialUrl] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: replace with real POST /api/digital-twins call
    console.log('Registering:', { websiteName, officialUrl })
    setIsModalOpen(false)
    setWebsiteName('')
    setOfficialUrl('')
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Digital Twin Manager</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium rounded-lg px-4 py-2 text-sm"
        >
          <Plus size={16} /> Register New Portal
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {mockDigitalTwins.map((dt) => (
          <div key={dt.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-3">
              <Fingerprint className="text-cyan-400" size={20} />
            </div>
            <h3 className="text-white font-medium">{dt.website_name}</h3>
            <p className="text-slate-500 text-xs mt-1">{dt.official_url}</p>
            <div className="flex items-center justify-between mt-4 text-xs">
              <span className="text-slate-400">Version {dt.fingerprint_version}</span>
              <span className="text-slate-500">{new Date(dt.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register Official Portal">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">Website Name</label>
            <input
              type="text"
              value={websiteName}
              onChange={(e) => setWebsiteName(e.target.value)}
              placeholder="YCCE ERP"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-500"
              required
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">Official URL</label>
            <input
              type="url"
              value={officialUrl}
              onChange={(e) => setOfficialUrl(e.target.value)}
              placeholder="https://erp.ycce.edu.in"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium rounded-lg py-2 transition"
          >
            Generate Digital Twin
          </button>
        </form>
      </Modal>
    </div>
  )
}