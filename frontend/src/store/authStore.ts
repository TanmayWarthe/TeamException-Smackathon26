import { create } from 'zustand'
import type { AuthState, User } from '../types'

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('ctip_token'),
  isAuthenticated: !!localStorage.getItem('ctip_token'),

  login: (user: User, token: string) => {
    localStorage.setItem('ctip_token', token)
    set({ user, token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('ctip_token')
    set({ user: null, token: null, isAuthenticated: false })
  },
}))