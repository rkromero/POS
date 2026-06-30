import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import RemitoFabrica from '../../components/RemitoFabrica'

const ESTADO_BADGE = {
  nuevo: 'bg-yellow-100 text-yellow-700',
  completado: 'bg-green-100 text-green-700',
  recepcionado: 'bg-blue-100 text-blue-700',
}

export default function FactoryOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [estadoFilter, setEstadoFilter] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [orderDetail, setOrderDetail] = useState({})
  const [completing, setCompleting] = useState(null)
  const [remito, setRemito] = useState(null)

  useEffect(() => { loadOrders() }, [estadoFilter])

  async function loadOrders() {
    setLoading(true)
    try {
      const params = estadoFilter ? `?estado=${estadoFilter}` : ''
      const res = await api.get(`/factory-orders${params}`)
      setOrders(res.data)
    } catch { toast.error('Error al cargar pedidos') }
    finally { setLoading(false) }
  }

  async function toggleDetail(id) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (orderDetail[id]) return
    try {
      const res = await api.get(`/factory-orders/${id}`)
      setOrderDetail(prev => ({ ...prev, [id]: res.data }))
    } catch { toast.error('Error al cargar detalle') }
  }

  async function handleComplete(id) {
    setCompleting(id)
    try {
      await api.patch(`/factory-orders/${id}/complete`)
      toast.success('Pedido marcado como completado')
      setOrders(prev => prev.map(o => o.id === id ? { ...o, estado: 'completado' } : o))
      setOrderDetail(prev => {
        if (!prev[id]) return prev
        return { ...prev, [id]: { ...prev[id], estado: 'completado' } }
      })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al completar pedido')
    } finally {
      setCompleting(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 gap-y-2 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#111111]">Pedidos a Fábrica</h1>
        <select
          className="input-field w-44 text-sm"
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}
        >
          <option value="">Todos</option>
          <option value="nuevo">Nuevos</option>
          <option value="completado">Completados</option>
        </select>
      </div>

      {loading ? (
        <p className="text-center text-[#444444] py-12">Cargando...</p>
      ) : orders.length === 0 ? (
        <p className="text-center text-[#444444] py-12">No hay pedidos</p>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="card p-0 overflow-hidden">
              <button
                onClick={() => toggleDetail(o.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-bold text-[#111111]">Pedido #{o.id}</p>
                    <p className="text-sm text-[#444444]">{o.local_nombre} · {o.user_nombre}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-[#444444]">Entrega</p>
                    <p className="text-sm font-semibold text-[#111111]">
                      {new Date(o.fecha_entrega).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${ESTADO_BADGE[o.estado]}`}>
                    {o.estado}
                  </span>
                  <span className="text-[#444444] text-sm">{expanded === o.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {expanded === o.id && (
                <div className="border-t border-[#E5E7EB] px-5 py-4">
                  {!orderDetail[o.id] ? (
                    <p className="text-sm text-[#444444]">Cargando detalle...</p>
                  ) : (() => {
                    const det = orderDetail[o.id]
                    const recibido = det.estado === 'recepcionado'
                    return (
                      <>
                        <div className="overflow-x-auto mb-4">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[#444444] border-b border-[#E5E7EB]">
                                <th className="text-left py-1.5 font-semibold">Producto</th>
                                <th className="text-center py-1.5 font-semibold">Pedido</th>
                                {recibido && <th className="text-center py-1.5 font-semibold">Recibido</th>}
                                {recibido && <th className="text-center py-1.5 font-semibold">Dif.</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {det.items.map(item => {
                                const d = item.cantidad_recibida == null ? null : item.cantidad_recibida - item.cantidad
                                return (
                                  <tr key={item.id} className="border-b border-gray-50">
                                    <td className="py-1.5 text-[#111111]">{item.producto_nombre}</td>
                                    <td className="py-1.5 text-center font-semibold">{item.cantidad}</td>
                                    {recibido && <td className="py-1.5 text-center">{item.cantidad_recibida == null ? '—' : item.cantidad_recibida}</td>}
                                    {recibido && (
                                      <td className={`py-1.5 text-center font-semibold ${d ? 'text-red-600' : 'text-green-600'}`}>
                                        {d == null ? '' : d === 0 ? 'OK' : d > 0 ? `+${d}` : d}
                                      </td>
                                    )}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        {det.notas && (
                          <p className="text-xs text-[#444444] mb-2 bg-gray-50 rounded-lg p-2">
                            Nota: {det.notas}
                          </p>
                        )}
                        {recibido && (
                          <p className="text-xs text-blue-700 mb-3 bg-blue-50 rounded-lg p-2">
                            Recepcionado por {det.recepcionado_por_nombre || '—'}
                            {det.recepcionado_at ? ` · ${new Date(det.recepcionado_at).toLocaleString('es-AR')}` : ''}
                            {det.notas_recepcion ? ` — ${det.notas_recepcion}` : ''}
                          </p>
                        )}
                        <p className="text-xs text-[#444444] mb-3">
                          Creado: {new Date(o.created_at).toLocaleString('es-AR')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => setRemito(det)} className="btn-secondary py-2 px-4 text-sm">
                            🖨️ Imprimir remito
                          </button>
                          {o.estado === 'nuevo' && (
                            <button
                              onClick={() => handleComplete(o.id)}
                              disabled={completing === o.id}
                              className="btn-primary py-2 px-5 text-sm"
                            >
                              {completing === o.id ? 'Procesando...' : '✓ Marcar como entregado'}
                            </button>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {remito && <RemitoFabrica order={remito} onClose={() => setRemito(null)} />}
    </div>
  )
}
