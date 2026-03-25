import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(email, password)
      toast.success(`¡Bienvenido/a, ${user.nombre}!`)
      navigate(user.role === 'admin' ? '/admin' : '/local')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-mimi-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-mimi-500 flex items-center justify-center text-white font-bold text-3xl mx-auto mb-3 shadow-lg">
            M
          </div>
          <h1 className="text-3xl font-bold text-[#111111]">Mimí</h1>
          <p className="text-[#444444] mt-1 text-sm">Sistema de Punto de Venta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#111111] mb-1.5">Email</label>
            <input
              type="email"
              className="input-field"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#111111] mb-1.5">Contraseña</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base mt-2"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-xs text-center text-[#444444] mt-6">
          Mimí POS · Sistema de gestión de ventas
        </p>
      </div>
    </div>
  )
}
