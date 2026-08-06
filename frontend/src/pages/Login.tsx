import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Shield, Lock, UserCheck, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api } from '../services/api'

export default function Login() {
  const [email, setEmail] = useState('admin111@gmail.com')
  const [password, setPassword] = useState('password123')
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
      setError('Please enter your email and password.')
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
        'Invalid email or password. Access restricted to authorized personnel.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickFill = () => {
    setEmail('admin111@gmail.com')
    setPassword('password123')
    setError('')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      <div className="w-full max-w-sm relative z-10">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs mb-3">
            <Shield className="text-blue-600 w-6 h-6" />
          </div>

          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Campus Threat Intelligence</h1>
          <p className="text-slate-500 text-xs mt-0.5">Admin Sign In</p>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-800 text-xs">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-slate-700 text-xs font-medium mb-1.5 flex items-center justify-between">
                <span>Email Address</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-900 placeholder-slate-400 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  placeholder="admin111@gmail.com"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-slate-700 text-xs font-medium mb-1.5 flex items-center justify-between">
                <span>Password</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-9 py-2 text-slate-900 placeholder-slate-400 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
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
              className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 px-4 text-sm shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>

            {/* Quick Fill Button */}
            <button
              type="button"
              onClick={handleQuickFill}
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg py-2 px-3 transition flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
              <span>Fill Demo Credentials (admin111@gmail.com)</span>
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 mt-5">
          Campus Threat Intelligence Platform
        </p>
      </div>
    </div>
  )
}