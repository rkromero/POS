import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminLocals from './pages/admin/Locals'
import AdminUsers from './pages/admin/Users'
import AdminProducts from './pages/admin/Products'
import AdminCategories from './pages/admin/Categories'
import LocalLayout from './pages/local/LocalLayout'
import POS from './pages/local/POS'
import SalesHistory from './pages/local/SalesHistory'
import LocalProducts from './pages/local/LocalProducts'
import LocalReports from './pages/local/LocalReports'
import PedidoFabrica from './pages/local/PedidoFabrica'
import CierreCaja from './pages/local/CierreCaja'
import Gastos from './pages/local/Gastos'
import AdminFactoryOrders from './pages/admin/FactoryOrders'
import WholesaleClients from './pages/admin/WholesaleClients'
import WholesaleOrders from './pages/admin/WholesaleOrders'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<PrivateRoute role="admin"><AdminLayout /></PrivateRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="locales" element={<AdminLocals />} />
          <Route path="usuarios" element={<AdminUsers />} />
          <Route path="productos" element={<AdminProducts />} />
          <Route path="categorias" element={<AdminCategories />} />
          <Route path="pedidos-fabrica" element={<AdminFactoryOrders />} />
          <Route path="mayoristas" element={<WholesaleClients />} />
          <Route path="mayoristas/nuevo-pedido" element={<WholesaleOrders />} />
        </Route>
        <Route path="/local" element={<PrivateRoute role="local"><LocalLayout /></PrivateRoute>}>
          <Route index element={<POS />} />
          <Route path="ventas" element={<SalesHistory />} />
          <Route path="productos" element={<LocalProducts />} />
          <Route path="reportes" element={<LocalReports />} />
          <Route path="cierre-caja" element={<CierreCaja />} />
          <Route path="gastos" element={<Gastos />} />
          <Route path="pedido-fabrica" element={<PedidoFabrica />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
