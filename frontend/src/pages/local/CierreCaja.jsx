import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

const METODOS = [
  { key: 'monto_efectivo', decKey: 'declarado_efectivo', inputKey: 'efectivo', label: 'Efectivo', icon: '💵' },
  { key: 'monto_debito', decKey: 'declarado_debito', inputKey: 'debito', label: 'Débito', icon: '💳' },
  { key: 'monto_credito', decKey: 'declarado_credito', inputKey: 'credito', label: 'Crédito', icon: '💳' },
  { key: 'monto_transferencia', decKey: 'declarado_transferencia', inputKey: 'transferencia', label: 'Transferencia', icon: '📲' },
]

export default function CierreCaja() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'administrador'

  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [notas, setNotas] = useState('')
  const [historial, setHistorial] = useState([])
  const [tab, setTab] = useState('hoy')
  const [declarado, setDeclarado] = useState({ efectivo: '', debito: '', credito: '', transferencia: '' })

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
    const fechaLabel = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long'
    })

    if (!confirm(`¿Confirmar cierre de turno del ${fechaLabel}?`)) return
    setClosing(true)
    try {
      await api.post('/cash-closings', {
        fecha,
        notas,
        declarado_efectivo: parseFloat(declarado.efectivo) || 0,
        declarado_debito: parseFloat(declarado.debito) || 0,
        declarado_credito: parseFloat(declarado.credito) || 0,
        declarado_transferencia: parseFloat(declarado.transferencia) || 0,
      })
      toast.success('Cierre de turno registrado')
      setDeclarado({ efectivo: '', debito: '', credito: '', transferencia: '' })
      setNotas('')
      loadSummary()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrar cierre')
    } finally { setClosing(false) }
  }

  const fechaLabel = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const decTotal = (parseFloat(declarado.efectivo) || 0) + (parseFloat(declarado.debito) || 0) +
                   (parseFloat(declarado.credito) || 0) + (parseFloat(declarado.transferencia) || 0)

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#111111]">Cierre de Caja</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('hoy')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === 'hoy' ? 'bg-mimi-500 text-white' : 'bg-white border border-[#E5E7EB] text-[#444444] hover:bg-gray-50'}`}
          >
            {isAdmin ? 'Ver día' : 'Mi turno'}
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
          ) : !isAdmin ? (
            /* ── VISTA CAJERA ── */
            data?.closing ? (
              /* Ya cerró el turno */
              <div className="card p-5 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                  <span className="text-green-600 text-lg">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-green-700">Turno cerrado</p>
                    <p className="text-xs text-green-600">
                      Cerrado a las {new Date(data.closing.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-[#E5E7EB]">
                  {METODOS.map(m => (
                    <div key={m.decKey} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        <span>{m.icon}</span>
                        <span className="text-sm font-medium text-[#111111]">{m.label}</span>
                      </div>
                      <span className={`text-sm font-bold ${parseFloat(data.closing[m.decKey]) > 0 ? 'text-[#111111]' : 'text-[#AAAAAA]'}`}>
                        {fmt(data.closing[m.decKey])}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-3 bg-mimi-50 rounded-xl px-3 mt-1">
                    <span className="text-sm font-bold text-[#111111]">TOTAL DECLARADO</span>
                    <span className="text-base font-bold text-mimi-500">{fmt(data.closing.declarado_total)}</span>
                  </div>
                </div>
                {data.closing.notas && (
                  <p className="text-xs text-[#444444] bg-gray-50 rounded-xl p-3">{data.closing.notas}</p>
                )}
              </div>
            ) : (
              /* Formulario de cierre de turno */
              <div className="card p-5 space-y-4">
                <p className="text-sm text-[#444444]">
                  Contá el dinero que juntaste en tu turno e ingresá los montos por método de pago.
                </p>
                <div className="space-y-3">
                  {METODOS.map(m => (
                    <div key={m.inputKey} className="flex items-center gap-3">
                      <span className="w-6 text-center text-base">{m.icon}</span>
                      <label className="text-sm font-medium text-[#111111] w-32 shrink-0">{m.label}</label>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#444444]">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0,00"
                          className="input-field pl-7 text-sm w-full"
                          value={declarado[m.inputKey]}
                          onChange={e => setDeclarado(prev => ({ ...prev, [m.inputKey]: e.target.value }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between bg-mimi-50 rounded-xl px-4 py-3">
                  <span className="text-sm font-bold text-[#111111]">TOTAL</span>
                  <span className="text-base font-bold text-mimi-500">{fmt(decTotal)}</span>
                </div>
                <textarea
                  className="input-field text-sm resize-none"
                  rows={2}
                  placeholder="Notas del turno (opcional)"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                />
                <button
                  onClick={handleCerrar}
                  disabled={closing || decTotal === 0}
                  className="btn-primary w-full py-3"
                >
                  {closing ? 'Registrando...' : '🔒 Cerrar turno'}
                </button>
                {decTotal === 0 && (
                  <p className="text-xs text-center text-[#444444]">Ingresá al menos un monto para cerrar</p>
                )}
              </div>
            )
          ) : (
            /* ── VISTA ADMIN ── */
            data && (
              <>
                {/* Cierres del día */}
                {data.closings?.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3">
                    <p className="text-sm font-semibold text-green-700 mb-1">
                      {data.closings.length} cierre{data.closings.length > 1 ? 's' : ''} registrado{data.closings.length > 1 ? 's' : ''}
                    </p>
                    {data.closings.map(c => (
                      <p key={c.id} className="text-xs text-green-600">
                        {c.user_nombre} · {new Date(c.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · declarado: {fmt(c.declarado_total)}
                      </p>
                    ))}
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

                {/* Desglose por método */}
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
                {data.sales?.length > 0 ? (
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
                              {new Date(s.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · {s.metodo_pago} · {s.user_nombre}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-[#111111]">{fmt(s.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="card p-6 text-center text-[#444444] text-sm">
                    No hay ventas registradas para este día
                  </div>
                )}
              </>
            )
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
                    {isAdmin && <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Cajera</th>}
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Efectivo</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Digital</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((c, i) => {
                    const efectivo = parseFloat(c.declarado_efectivo || c.monto_efectivo || 0)
                    const digital = parseFloat(c.declarado_debito || c.monto_debito || 0) +
                                    parseFloat(c.declarado_credito || c.monto_credito || 0) +
                                    parseFloat(c.declarado_transferencia || c.monto_transferencia || 0)
                    const total = parseFloat(c.declarado_total || c.monto_total || 0)
                    return (
                      <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[#111111] capitalize">
                            {new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                          <p className="text-xs text-[#444444]">
                            {new Date(c.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        {isAdmin && <td className="py-3 px-4 text-[#111111]">{c.user_nombre}</td>}
                        <td className="py-3 px-4 text-right text-[#111111]">{fmt(efectivo)}</td>
                        <td className="py-3 px-4 text-right text-[#111111]">{fmt(digital)}</td>
                        <td className="py-3 px-4 text-right font-bold text-mimi-500">{fmt(total)}</td>
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
