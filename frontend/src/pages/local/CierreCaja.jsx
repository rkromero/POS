import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

const METODOS = [
  { key: 'monto_efectivo', label: 'Efectivo', icon: '💵' },
  { key: 'monto_debito', label: 'Débito', icon: '💳' },
  { key: 'monto_credito', label: 'Crédito', icon: '💳' },
  { key: 'monto_transferencia', label: 'Transferencia', icon: '📲' },
]

export default function CierreCaja() {
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [notas, setNotas] = useState('')
  const [historial, setHistorial] = useState([])
  const [tab, setTab] = useState('hoy')

  useEffect(() => {
    if (tab === 'hoy') loadSummary()
    else loadHistorial()
  }, [fecha, tab])

  async function loadSummary() {
    setLoading(true)
    try {
      const res = await api.get(`/cash-closings/summary?fecha=${fecha}`)
      setData(res.data)
    } catch { toast.error('Error al cargar el cierre') }
    finally { setLoading(false) }
  }

  async function loadHistorial() {
    setLoading(true)
    try {
      const res = await api.get('/cash-closings')
      setHistorial(res.data)
    } catch { toast.error('Error al cargar historial') }
    finally { setLoading(false) }
  }

  async function handleCerrar() {
    if (!confirm(`¿Confirmar cierre de caja del ${new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}?`)) return
    setClosing(true)
    try {
      await api.post('/cash-closings', { fecha, notas })
      toast.success('Cierre registrado correctamente')
      loadSummary()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrar cierre')
    } finally {
      setClosing(false)
    }
  }

  const fechaLabel = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#111111]">Cierre de Caja</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('hoy')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === 'hoy' ? 'bg-mimi-500 text-white' : 'bg-white border border-[#E5E7EB] text-[#444444] hover:bg-gray-50'}`}
          >
            Ver día
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === 'historial' ? 'bg-mimi-500 text-white' : 'bg-white border border-[#E5E7EB] text-[#444444] hover:bg-gray-50'}`}
          >
            Historial
          </button>
        </div>
      </div>

      {tab === 'hoy' && (
        <>
          {/* Selector de fecha */}
          <div className="card p-4 flex items-center gap-3">
            <label className="text-sm font-medium text-[#444444]">Fecha:</label>
            <input
              type="date"
              className="input-field w-40 text-sm"
              value={fecha}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setFecha(e.target.value)}
            />
            <span className="text-sm text-[#444444] capitalize">{fechaLabel}</span>
          </div>

          {loading ? (
            <p className="text-center text-[#444444] py-12">Cargando...</p>
          ) : data && (
            <>
              {/* Estado del cierre */}
              {data.closing && (
                <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                  <span className="text-green-600 text-lg">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-green-700">Caja cerrada</p>
                    <p className="text-xs text-green-600">
                      Cerrada por {data.closing.user_nombre} a las {new Date(data.closing.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}

              {/* Resumen total */}
              <div className="grid grid-cols-2 gap-3">
                <div className="card p-4">
                  <p className="text-xs text-[#444444] font-medium uppercase tracking-wide">Total ventas</p>
                  <p className="text-3xl font-bold text-[#111111] mt-1">{data.total_ventas}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-[#444444] font-medium uppercase tracking-wide">Monto total</p>
                  <p className="text-3xl font-bold text-mimi-500 mt-1">{fmt(data.monto_total)}</p>
                </div>
              </div>

              {/* Desglose por método de pago */}
              <div className="card p-0 overflow-hidden">
                <div className="px-5 py-3 border-b border-[#E5E7EB]">
                  <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wide">Desglose por método de pago</h2>
                </div>
                <div className="divide-y divide-[#E5E7EB]">
                  {METODOS.map(m => (
                    <div key={m.key} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span>{m.icon}</span>
                        <span className="text-sm font-medium text-[#111111]">{m.label}</span>
                      </div>
                      <span className={`text-sm font-bold ${parseFloat(data[m.key]) > 0 ? 'text-[#111111]' : 'text-[#AAAAAA]'}`}>
                        {fmt(data[m.key])}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-5 py-3.5 bg-mimi-50">
                    <span className="text-sm font-bold text-[#111111]">TOTAL</span>
                    <span className="text-base font-bold text-mimi-500">{fmt(data.monto_total)}</span>
                  </div>
                </div>
              </div>

              {/* Listado de ventas */}
              {data.sales.length > 0 && (
                <div className="card p-0 overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#E5E7EB]">
                    <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wide">Ventas del día ({data.sales.length})</h2>
                  </div>
                  <div className="divide-y divide-[#E5E7EB] max-h-64 overflow-auto">
                    {data.sales.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-5 py-2.5">
                        <div>
                          <p className="text-xs font-semibold text-[#111111]">#{s.numero_comprobante} · {s.cliente_nombre}</p>
                          <p className="text-xs text-[#444444]">
                            {new Date(s.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · {s.metodo_pago}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-[#111111]">{fmt(s.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.sales.length === 0 && (
                <div className="card p-6 text-center text-[#444444] text-sm">
                  No hay ventas registradas para este día
                </div>
              )}

              {/* Botón cierre */}
              {!data.closing && (
                <div className="card p-4 space-y-3">
                  <textarea
                    className="input-field text-sm resize-none"
                    rows={2}
                    placeholder="Notas del cierre (opcional)"
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                  />
                  <button
                    onClick={handleCerrar}
                    disabled={closing || data.sales.length === 0}
                    className="btn-primary w-full py-3"
                  >
                    {closing ? 'Registrando...' : '🔒 Cerrar caja'}
                  </button>
                  {data.sales.length === 0 && (
                    <p className="text-xs text-center text-[#444444]">No hay ventas para cerrar</p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'historial' && (
        <>
          {loading ? (
            <p className="text-center text-[#444444] py-12">Cargando...</p>
          ) : historial.length === 0 ? (
            <div className="card p-6 text-center text-[#444444] text-sm">No hay cierres registrados</div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-mimi-50 border-b border-[#E5E7EB]">
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Fecha</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Ventas</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Efectivo</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Digital</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((c, i) => {
                    const digital = parseFloat(c.monto_debito) + parseFloat(c.monto_credito) + parseFloat(c.monto_transferencia)
                    return (
                      <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[#111111] capitalize">
                            {new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                          <p className="text-xs text-[#444444]">{c.user_nombre}</p>
                        </td>
                        <td className="py-3 px-4 text-right text-[#111111]">{c.total_ventas}</td>
                        <td className="py-3 px-4 text-right text-[#111111]">{fmt(c.monto_efectivo)}</td>
                        <td className="py-3 px-4 text-right text-[#111111]">{fmt(digital)}</td>
                        <td className="py-3 px-4 text-right font-bold text-mimi-500">{fmt(c.monto_total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
