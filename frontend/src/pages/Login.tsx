import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // TODO: replace with real API call to backend /api/auth/login
    // Mock login for now
    if (email && password) {
      login(
        { id: '1', name: 'Administrator', email, role: 'ADMIN' },
        'mock-jwt-token'
      )
      navigate('/dashboard')
    } else {
      setError('Please enter email and password')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
            <Shield className="text-cyan-400" size={28} />
          </div>
          <h1 className="text-xl font-semibold text-white">CTIP Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Campus Threat Intelligence Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-500"
              placeholder="admin@college.edu"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-500"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium rounded-lg py-2 transition"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}