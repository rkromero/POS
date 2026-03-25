import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/admin' || to === '/local'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-xl mx-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-mimi-50 text-mimi-500'
            : 'text-[#444444] hover:bg-gray-50 hover:text-[#111111]'
        }`
      }
    >
      <span>{icon}</span>
      {label}
    </NavLink>
  )
}

export default function Sidebar({ links }) {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    toast.success('Sesión cerrada')
    navigate('/login')
  }

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-[#E5E7EB] flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-[#E5E7EB]">
        <div className="w-8 h-8 rounded-full bg-mimi-500 flex items-center justify-center text-white font-bold text-base">M</div>
        <span className="text-xl font-bold text-[#111111]">Mimí</span>
        <span className="text-xs text-mimi-500 font-semibold bg-mimi-50 px-1.5 py-0.5 rounded-full ml-auto">POS</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 pt-4 flex-1">
        {links.map(link => <NavItem key={link.to} {...link} />)}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-[#E5E7EB]">
        <div className="flex items-center gap-2.5 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-mimi-50 flex items-center justify-center text-mimi-500 font-bold text-sm flex-shrink-0">
            {user?.nombre?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111111] truncate leading-none">{user?.nombre}</p>
            <p className="text-xs text-[#444444] truncate mt-0.5">{user?.local_nombre || 'Administrador'}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-secondary w-full text-sm py-1.5">
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
