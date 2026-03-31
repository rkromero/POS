import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import Ticket from '../../components/Ticket'

const PAYMENT_LABELS = { efectivo: 'Efectivo', debito: 'Débito', credito: 'Crédito', transferencia: 'Transferencia' }
const fmt = (v) => `$${parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
const fmtDate = (d) => new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

export default function SalesHistory() {
  const [sales, setSales] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [selected, setSelected] = useState(null)

  const load = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      const res = await api.get(`/sales?${params}`)
      setSales(res.data.data)
      setTotal(res.data.total)
    } catch { toast.error('Error al cargar ventas') }
  }

  useEffect(() => { load() }, [page, desde, hasta])

  const openDetail = async (id) => {
    try { setSelected((await api.get(`/sales/${id}`)).data) }
    catch { toast.error('Error al cargar detalle') }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-[#111111]">Historial de ventas</h1>

      <div className="flex gap-3 mb-4 flex-wrap items-end">
        <div>
          <label className="block text-xs font-medium text-[#444444] mb-1">Desde</label>
          <input type="date" className="input-field w-36 text-sm" value={desde} onChange={e => { setDesde(e.target.value); setPage(1) }} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#444444] mb-1">Hasta</label>
          <input type="date" className="input-field w-36 text-sm" value={hasta} onChange={e => { setHasta(e.target.value); setPage(1) }} />
        </div>
        {(desde || hasta) && (
          <button onClick={() => { setDesde(''); setHasta(''); setPage(1) }} className="btn-secondary text-xs py-2 px-3">
            Limpiar filtros
          </button>
        )}
      </div>

      {sales.length > 0 && (
        <div className="flex gap-4 mb-4">
          <div className="card py-3 px-4 flex-1">
            <p className="text-xs text-[#444444]">Ventas en página</p>
            <p className="text-xl font-bold text-[#111111]">{sales.length}</p>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mimi-50">
              <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">N°</th>
              <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Cliente</th>
              <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Pago</th>
              <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Fecha</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s, i) => (
              <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-3 px-4 font-mono text-[#444444] text-xs">#{String(s.numero_comprobante).padStart(6, '0')}</td>
                <td className="py-3 px-4 font-medium">{s.cliente_nombre}</td>
                <td className="py-3 px-4 text-[#444444]">{PAYMENT_LABELS[s.metodo_pago]}</td>
                <td className="py-3 px-4 text-[#444444] text-xs">{fmtDate(s.created_at)}</td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => openDetail(s.id)} className="text-mimi-500 hover:underline text-xs font-medium">
                    Ver comprobante
                  </button>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr><td colSpan="5" className="text-center py-12 text-[#444444]">No hay ventas registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4 text-sm text-[#444444]">
        <span>{total} ventas en total</span>
        <div className="flex gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="btn-secondary py-1 px-3 text-xs">Anterior</button>
          <button disabled={page * 20 >= total} onClick={() => setPage(p => p+1)} className="btn-secondary py-1 px-3 text-xs">Siguiente</button>
        </div>
      </div>

      {selected && <Ticket sale={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
