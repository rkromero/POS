import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'

const adminLinks = [
  { to: '/admin', icon: '📊', label: 'Dashboard' },
  { to: '/admin/locales', icon: '🏪', label: 'Locales' },
  { to: '/admin/usuarios', icon: '👥', label: 'Usuarios' },
  { to: '/admin/productos', icon: '📦', label: 'Productos' },
  { to: '/admin/categorias', icon: '🏷️', label: 'Categorías' },
  { to: '/admin/pedidos-fabrica', icon: '🏭', label: 'Pedidos a Fábrica' },
  { to: '/admin/mayoristas', icon: '🏬', label: 'Mayoristas' },
]

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={adminLinks} />
      <main className="flex-1 p-8 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
