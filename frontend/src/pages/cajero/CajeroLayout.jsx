import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'

const cajeroLinks = [
  { to: '/cajero', icon: '💰', label: 'A cobrar' },
  { to: '/cajero/pos', icon: '🛒', label: 'POS' },
  { to: '/cajero/cierre-caja', icon: '🔒', label: 'Cierre de Caja' },
]

export default function CajeroLayout() {
  const { pathname } = useLocation()
  // El POS ocupa todo el alto disponible (en mobile descuenta la barra superior del menú)
  const isPOS = pathname.startsWith('/cajero/pos')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={cajeroLinks} />
      <main
        className={
          isPOS
            ? 'flex-1 min-w-0 h-[100dvh] overflow-hidden px-2 pb-2 pt-16 sm:px-3 sm:pb-3 md:pt-3'
            : 'flex-1 min-w-0 overflow-auto px-4 sm:px-6 pb-6 pt-[4.5rem] md:pt-6'
        }
      >
        <Outlet />
      </main>
    </div>
  )
}
