import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
// Parsea timestamps de PostgreSQL que pueden venir como "2026-03-27 15:30:00+00" o ISO
const parseTS = (v) => v ? new Date(String(v).replace(' ', 'T').replace(/(\+\d{2})$/, '$1:00')) : new Date('invalid')
const fmtFechaHora = (v) => parseTS(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
const itemCantidad = (i) => i.unidad_medida === 'kg' ? `${i.cantidad}g` : `×${i.cantidad}`

export default function PedidosPorCobrar() {
  const [pedidos, setPedidos] = useState([])
  const [locals, setLocals] = useState([])
  const [localId, setLocalId] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState(null)
  const [cancelando, setCancelando] = useState(false)

  useEffect(() => {
    api.get('/locals?limit=100')
      .then(res => setLocals(res.data.data))
      .catch(() => toast.error('Error al cargar locales'))
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/pedidos-caja', { params: localId ? { local_id: localId } : {} })
      setPedidos(res.data)
    } catch { toast.error('Error al cargar los pedidos') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [localId])

  async function cancelar(id) {
    setCancelando(true)
    try {
      await api.patch(`/pedidos-caja/${id}/cancel`)
      toast.success('Pedido cancelado')
      setConfirmId(null)
      setPedidos(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cancelar el pedido')
      setConfirmId(null)
      load()
    } finally { setCancelando(false) }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 gap-y-2 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#111111]">Pedidos por cobrar</h1>
        <div className="flex items-center gap-2">
          <select className="input-field w-48 text-sm" value={localId} onChange={e => setLocalId(e.target.value)}>
            <option value="">Todos los locales</option>
            {locals.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
          <button onClick={load} className="btn-secondary text-sm py-2 px-3" title="Actualizar">↻</button>
        </div>
      </div>

      <div className="card p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-mimi-50">
              {['Fecha', 'Local', 'Pedido', 'Cargó', 'Items', 'Total', ''].map((h, i) => (
                <th key={i} className={`py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444] ${i >= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center py-8 text-[#444444]">Cargando...</td></tr>
            ) : pedidos.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-8 text-[#444444]">No hay pedidos pendientes de cobro</td></tr>
            ) : pedidos.map((p, i) => (
              <tr key={p.id} className={`align-top ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                <td className="py-3 px-4 text-[#444444] whitespace-nowrap">{fmtFechaHora(p.created_at)}</td>
                <td className="py-3 px-4">{p.local_nombre}</td>
                <td className="py-3 px-4">
                  <p className="font-medium">{p.nombre_carrito || `#${p.id}`}</p>
                  {p.cliente_nombre && <p className="text-xs text-[#444444]">Cliente: {p.cliente_nombre}</p>}
                </td>
                <td className="py-3 px-4 text-[#444444]">{p.user_nombre}</td>
                <td className="py-3 px-4 text-xs text-[#444444]">
                  {p.items.map(it => (
                    <div key={it.id}>{it.producto_nombre} {itemCantidad(it)}</div>
                  ))}
                </td>
                <td className="py-3 px-4 text-right font-semibold whitespace-nowrap">{fmt(p.total_estimado)}</td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  {confirmId === p.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-[#444444]">¿Cancelar?</span>
                      <button
                        onClick={() => cancelar(p.id)}
                        disabled={cancelando}
                        className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg px-2 py-1"
                      >
                        {cancelando ? '...' : 'Sí'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        disabled={cancelando}
                        className="text-xs font-medium text-[#444444] hover:underline"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(p.id)} className="text-red-500 hover:underline text-xs font-medium">
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
