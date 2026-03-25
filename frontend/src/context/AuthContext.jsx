import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout') } catch {}
    setUser(null)
    setToken(null)
    delete api.defaults.headers.common['Authorization']
  }, [])

  useEffect(() => {
    async function restore() {
      try {
        const res = await api.post('/auth/refresh')
        setToken(res.data.accessToken)
        setUser(res.data.user)
        api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`
      } catch {
        // Sin sesión activa
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    setToken(res.data.accessToken)
    setUser(res.data.user)
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`
    return res.data.user
  }

  // Renovar token cada 12 minutos
  useEffect(() => {
    if (!token) return
    const interval = setInterval(async () => {
      try {
        const res = await api.post('/auth/refresh')
        setToken(res.data.accessToken)
        api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`
      } catch {
        logout()
      }
    }, 12 * 60 * 1000)
    return () => clearInterval(interval)
  }, [token, logout])

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
