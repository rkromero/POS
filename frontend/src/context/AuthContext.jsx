import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

const USER_KEY = 'pos_user'

export function AuthProvider({ children }) {
  // Inicializar desde localStorage para evitar flash de logout al refrescar
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
  })
  const [token, setToken] = useState(null)
  // Si hay usuario en cache, no mostrar loading (evita redirect inmediato)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout') } catch {}
    localStorage.removeItem(USER_KEY)
    setUser(null)
    setToken(null)
    delete api.defaults.headers.common['Authorization']
  }, [])

  useEffect(() => {
    async function restore() {
      try {
        const res = await api.post('/auth/refresh')
        const u = res.data.user
        localStorage.setItem(USER_KEY, JSON.stringify(u))
        setToken(res.data.accessToken)
        setUser(u)
        api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`
      } catch (err) {
        // Solo limpiar sesión si el servidor confirma que es inválida (401)
        // Un error de red o 5xx no debe cerrar la sesión
        if (err.response?.status === 401) {
          localStorage.removeItem(USER_KEY)
          setUser(null)
        }
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const u = res.data.user
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setToken(res.data.accessToken)
    setUser(u)
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`
    return u
  }

  // Renovar token cada 12 minutos
  useEffect(() => {
    if (!token) return
    const interval = setInterval(async () => {
      try {
        const res = await api.post('/auth/refresh')
        const u = res.data.user
        localStorage.setItem(USER_KEY, JSON.stringify(u))
        setToken(res.data.accessToken)
        setUser(u)
        api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`
      } catch (err) {
        // Solo cerrar sesión ante 401 real; ignorar errores de red
        if (err.response?.status === 401) logout()
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
