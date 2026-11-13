import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'

const localLinks = [
  { to: '/local', icon: '🛒', label: 'Caja / POS' },
  { to: '/local/ventas', icon: '📋', label: 'Historial de ventas' },
  { to: '/local/canjes', icon: '🎁', label: 'Canjes' },
  { to: '/local/cierre-caja', icon: '🔒', label: 'Cierre de Caja' },
  { to: '/local/gastos', icon: '💸', label: 'Gastos' },
  { to: '/local/merma', icon: '🗑️', label: 'Merma Productos' },
  { to: '/local/pedido-fabrica', icon: '🏭', label: 'Pedido a Fábrica' },
  { to: '/local/productos', icon: '📦', label: 'Productos' },
  { to: '/local/reportes', icon: '📊', label: 'Reportes' },
]

export default function LocalLayout() {
  const { pathname } = useLocation()
  // El POS ocupa toda la pantalla y deja lugar al botón de menú en su barra superior
  const isPOS = pathname === '/local' || pathname === '/local/'

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <Sidebar links={localLinks} collapsible />
      <main
        className={
          isPOS
            ? 'h-[100dvh] overflow-hidden p-2 sm:p-3'
            : 'min-w-0 overflow-x-hidden px-4 sm:px-6 pb-6 pt-16'
        }
      >
        <Outlet />
      </main>
    </div>
  )
}
