import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import Ticket from '../../components/Ticket'

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo', icon: '💵' },
  { value: 'debito', label: 'Tarjeta de débito', icon: '💳' },
  { value: 'credito', label: 'Tarjeta de crédito', icon: '💳' },
  { value: 'transferencia', label: 'Transferencia', icon: '📲' },
]

const POLL_MS = 10000

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
// Parsea timestamps de PostgreSQL que pueden venir como "2026-03-27 15:30:00+00" o ISO
const parseTS = (v) => v ? new Date(String(v).replace(' ', 'T').replace(/(\+\d{2})$/, '$1:00')) : new Date('invalid')
const fmtHora = (v) => parseTS(v).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

const itemCantidad = (i) => i.unidad_medida === 'kg' ? `${i.cantidad}g` : `×${i.cantidad}`

export default function ACobrar() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [cobrando, setCobrando] = useState(false)
  const [ticket, setTicket] = useState(null)
  const inFlight = useRef(false)

  async function load({ silent = false } = {}) {
    if (inFlight.current) return
    inFlight.current = true
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/pedidos-caja')
      setPedidos(res.data)
    } catch {
      if (!silent) toast.error('Error al cargar los pedidos')
    } finally {
      inFlight.current = false
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(() => load({ silent: true }), POLL_MS)
    return () => clearInterval(t)
  }, [])

  const openCobro = (p) => {
    setSelected(p)
    setMetodoPago('efectivo')
  }

  async function confirmarCobro() {
    if (!selected) return
    setCobrando(true)
    try {
      const res = await api.post(`/pedidos-caja/${selected.id}/cobrar`, { metodo_pago: metodoPago })
      toast.success(`Cobrado ${fmt(res.data.sale.total)}`)
      setTicket(res.data.sale)
      setSelected(null)
      setPedidos(prev => prev.filter(p => p.id !== selected.id))
      load({ silent: true })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cobrar el pedido')
      // Si ya lo cobró otro cajero, refrescamos la lista
      if (err.response?.status === 409 || err.response?.status === 404) {
        setSelected(null)
        load({ silent: true })
      }
    } finally {
      setCobrando(false)
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111111]">A cobrar</h1>
          <p className="text-xs text-[#444444] mt-0.5">Se actualiza automáticamente cada 10 segundos</p>
        </div>
        <button onClick={() => load()} className="btn-secondary text-sm py-1.5 px-4">↻ Actualizar</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-mimi-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-2">✓</p>
          <p className="text-[#444444]">No hay pedidos pendientes de cobro</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pedidos.map(p => (
            <div key={p.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-[#111111] truncate">{p.nombre_carrito || p.cliente_nombre || `Pedido #${p.id}`}</p>
                  {p.cliente_nombre && p.cliente_nombre !== p.nombre_carrito && (
                    <p className="text-xs text-[#444444] truncate">Cliente: {p.cliente_nombre}</p>
                  )}
                  <p className="text-xs text-[#444444] mt-0.5">
                    Cargó {p.user_nombre} · {fmtHora(p.created_at)}
                  </p>
                </div>
                <span className="text-lg font-bold text-mimi-500 flex-shrink-0">{fmt(p.total_estimado)}</span>
              </div>

              <div className="border-t border-[#E5E7EB] pt-2 space-y-0.5">
                {p.items.map(i => (
                  <div key={i.id} className="flex justify-between text-xs text-[#444444]">
                    <span className="truncate pr-2">{i.producto_nombre} {itemCantidad(i)}</span>
                    <span className="font-medium flex-shrink-0">{fmt(i.subtotal)}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => openCobro(p)} className="btn-primary w-full py-2.5 mt-auto">
                Cobrar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal de cobro */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-[#111111] mb-0.5">
              Cobrar {selected.nombre_carrito || selected.cliente_nombre || `pedido #${selected.id}`}
            </h2>
            <p className="text-sm text-[#444444] mb-4">
              Total: <span className="font-bold text-mimi-500 text-base">{fmt(selected.total_estimado)}</span>
            </p>
            <p className="text-xs font-semibold text-[#444444] uppercase tracking-wide mb-2">Medio de pago</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMetodoPago(m.value)}
                  className={`py-3 px-2 rounded-xl border text-sm font-semibold transition-colors ${
                    metodoPago === m.value
                      ? 'bg-mimi-500 border-mimi-500 text-white'
                      : 'bg-white border-[#E5E7EB] text-[#444444] hover:border-mimi-300'
                  }`}
                >
                  <span className="mr-1">{m.icon}</span>{m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmarCobro} disabled={cobrando} className="btn-primary flex-1 py-3">
                {cobrando ? 'Cobrando...' : '✓ Confirmar cobro'}
              </button>
              <button onClick={() => setSelected(null)} disabled={cobrando} className="btn-secondary flex-1 py-3">
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {ticket && <Ticket sale={ticket} onClose={() => setTicket(null)} />}
    </div>
  )
}
