import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Shield, Lock, UserCheck, KeyRound, AlertCircle, Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api } from '../services/api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((state) => state.login)

  const from = (location.state as any)?.from?.pathname || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanEmail = email.trim()
    const cleanPassword = password.trim()

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter your Admin Identifier and Security Password.')
      return
    }

    setLoading(true)
    try {
      const data = await api.login(cleanEmail, cleanPassword)
      login(data.user, data.token)
      navigate(from, { replace: true })
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Invalid Admin ID or Password. Access is restricted to authorized SOC personnel.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickFill = () => {
    setEmail('admin@ycce.edu')
    setPassword('admin123')
    setError('')
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] flex flex-col items-center justify-center p-4 selection:bg-cyan-500 selection:text-black">
      {/* Background Cyber Ambient Elements */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur-lg opacity-40 group-hover:opacity-75 transition duration-500" />
            <div className="relative w-16 h-16 rounded-2xl bg-slate-900 border border-cyan-500/40 flex items-center justify-center shadow-2xl">
              <Shield className="text-cyan-400 w-8 h-8 drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]" />
            </div>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono tracking-wider">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            RESTRICTED ACCESS • SOC ONLY
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight mt-2">CTIP Security Operations</h1>
          <p className="text-slate-400 text-sm mt-1">Campus Threat Intelligence & Digital Twin Defense</p>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-7 border border-slate-800 shadow-2xl shadow-cyan-950/20">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 flex items-start gap-3 text-red-200 text-sm animate-shake">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Admin ID */}
            <div>
              <label className="block text-slate-300 text-xs font-medium uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>SOC Admin ID / Email</span>
                <span className="text-slate-500 text-[11px] font-mono">admin@ycce.edu</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <UserCheck className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono"
                  placeholder="admin@ycce.edu or admin"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-slate-300 text-xs font-medium uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Master Passkey</span>
                <span className="text-slate-500 text-[11px] font-mono">admin123</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-white placeholder-slate-600 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold rounded-xl py-2.5 px-4 text-sm shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Authenticate to SOC Console</span>
                </>
              )}
            </button>

            {/* 1-Click Quick Fill Demo Button */}
            <button
              type="button"
              onClick={handleQuickFill}
              className="w-full mt-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 text-xs font-medium rounded-xl py-2 px-3 transition flex items-center justify-center gap-2 hover:border-cyan-500/40"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>⚡ Quick-Fill Demo Admin Credentials (admin@ycce.edu / admin123)</span>
            </button>
          </form>

          {/* User Isolation Info */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="flex items-start gap-2.5 text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-slate-300">General Users & Students:</strong> Protected automatically in real time via the CTIP Shield extension without needing SOC portal login credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-600 mt-6">
          CTIP • Institutional Cyber Defense • Protected by Multi-Modal AI
        </p>
      </div>
    </div>
  )
}