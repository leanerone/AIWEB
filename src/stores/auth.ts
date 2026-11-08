import { create } from 'zustand'
import type { AuthUser } from '../types'

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  clear: () => void
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem('aiweb_token'),
  user: JSON.parse(localStorage.getItem('aiweb_user') || 'null'),
  setAuth: (token, user) => {
    localStorage.setItem('aiweb_token', token)
    localStorage.setItem('aiweb_user', JSON.stringify(user))
    set({ token, user })
  },
  clear: () => {
    localStorage.removeItem('aiweb_token')
    localStorage.removeItem('aiweb_user')
    set({ token: null, user: null })
  },
}))
