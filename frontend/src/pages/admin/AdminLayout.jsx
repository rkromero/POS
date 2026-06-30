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
  { to: '/admin/fidelizacion', icon: '⭐', label: 'Fidelización' },
  { to: '/admin/cierres-caja', icon: '💰', label: 'Cierres de Caja' },
]

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={adminLinks} />
      <main className="flex-1 min-w-0 overflow-auto px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8 pt-[4.5rem] md:pt-8">
        <Outlet />
      </main>
    </div>
  )
}
