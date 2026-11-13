import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Pantalla de inicio de cada rol
export const homeForRole = (role) => {
  if (role === 'admin') return '/admin'
  if (role === 'cajero') return '/cajero'
  return '/local'
}

export default function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-mimi-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={homeForRole(user.role)} replace />

  return children
}
