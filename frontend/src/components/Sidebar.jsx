import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

function NavItem({ to, icon, label, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={to === '/admin' || to === '/local'}
      onClick={onNavigate}
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

function SidebarContent({ links, user, onLogout, onNavigate, headerRight }) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#E5E7EB] flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-mimi-500 flex items-center justify-center text-white font-bold text-base">M</div>
        <span className="text-xl font-bold text-[#111111]">Mimí</span>
        <div className="ml-auto">{headerRight}</div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 pt-4 flex-1 overflow-y-auto">
        {links.map(link => <NavItem key={link.to} {...link} onNavigate={onNavigate} />)}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-[#E5E7EB] flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-mimi-50 flex items-center justify-center text-mimi-500 font-bold text-sm flex-shrink-0">
            {user?.nombre?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111111] truncate leading-none">{user?.nombre}</p>
            <p className="text-xs text-[#444444] truncate mt-0.5">{user?.local_nombre || 'Administrador'}</p>
          </div>
        </div>
        <button onClick={onLogout} className="btn-secondary w-full text-sm py-1.5">
          Cerrar sesión
        </button>
      </div>
    </>
  )
}

const PosBadge = () => (
  <span className="text-xs text-mimi-500 font-semibold bg-mimi-50 px-1.5 py-0.5 rounded-full">POS</span>
)

export default function Sidebar({ links }) {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    toast.success('Sesión cerrada')
    navigate('/login')
  }

  return (
    <>
      {/* Barra superior (sólo mobile) */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-[#E5E7EB] z-30 flex items-center gap-3 px-4">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="w-9 h-9 -ml-1 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#111111]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-mimi-500 flex items-center justify-center text-white font-bold text-sm">M</div>
          <span className="text-lg font-bold text-[#111111]">Mimí</span>
          <PosBadge />
        </div>
      </header>

      {/* Sidebar fijo (desktop) */}
      <aside className="hidden md:flex w-60 min-h-screen bg-white border-r border-[#E5E7EB] flex-col flex-shrink-0">
        <SidebarContent links={links} user={user} onLogout={handleLogout} headerRight={<PosBadge />} />
      </aside>

      {/* Drawer deslizable (mobile) */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute top-0 left-0 h-full w-72 max-w-[85%] bg-white shadow-xl flex flex-col animate-drawer">
            <SidebarContent
              links={links}
              user={user}
              onLogout={handleLogout}
              onNavigate={() => setOpen(false)}
              headerRight={
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar menú"
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#444444] text-lg"
                >
                  ✕
                </button>
              }
            />
          </aside>
        </div>
      )}
    </>
  )
}
