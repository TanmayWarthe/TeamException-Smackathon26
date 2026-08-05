import { create } from 'zustand'
import type { AuthState, User } from '../types'

function getInitialUser(): User | null {
  try {
    const raw = localStorage.getItem('ctip_admin_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => {
  const initialToken = localStorage.getItem('ctip_token')
  const initialUser = getInitialUser()

  return {
    user: initialUser,
    token: initialToken,
    isAuthenticated: !!initialToken,

    login: (user: User, token: string) => {
      localStorage.setItem('ctip_token', token)
      localStorage.setItem('ctip_admin_user', JSON.stringify(user))
      set({ user, token, isAuthenticated: true })
    },

    logout: () => {
      localStorage.removeItem('ctip_token')
      localStorage.removeItem('ctip_admin_user')
      set({ user: null, token: null, isAuthenticated: false })
    },
  }
})