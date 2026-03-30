import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
// pg puede devolver DATE como string "YYYY-MM-DD" o como objeto Date; extraemos YYYY-MM-DD seguro
const toYMD = (d) => (d ? String(d).slice(0, 10) : '')
const fmtDate = (d) => { const s = toYMD(d); if (!s) return '—'; const [y, m, day] = s.split('-'); return `${day}/${m}/${y}` }

export default function AdminCierresCaja() {
  const [tab, setTab] = useState('consolidado')
  const [consolidado, setConsolidado] = useState([])
  const [cierres, setCierres] = useState([])
  const [locals, setLocals] = useState([])
  const [filtroLocal, setFiltroLocal] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [desde, setDesde] = useState(today())
  const [hasta, setHasta] = useState(today())
  const [localConsolidado, setLocalConsolidado] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingConsolidado, setLoadingConsolidado] = useState(false)
  const [expandedRows, setExpandedRows] = useState(new Set())

  const loadLocals = async () => {
    try {
      const lr = await api.get('/locals?limit=100')
      setLocals(lr.data.data || lr.data)
    } catch { /* silent */ }
  }

  const loadConsolidado = async () => {
    setLoadingConsolidado(true)
    try {
      const params = new URLSearchParams({ desde, hasta })
      if (localConsolidado) params.set('local_id', localConsolidado)
      const r = await api.get(`/cash-closings/consolidated?${params}`)
      setConsolidado(r.data)
    } catch {
      toast.error('Error al cargar consolidado')
    } finally {
      setLoadingConsolidado(false)
    }
  }

  const loadDetalle = async () => {
    setLoading(true)
    try {
      const r = await api.get('/cash-closings' + (filtroLocal ? `?local_id=${filtroLocal}` : ''))
      setCierres(r.data)
    } catch {
      toast.error('Error al cargar cierres de caja')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLocals()
    loadConsolidado()
  }, [])

  useEffect(() => {
    if (tab === 'detalle') loadDetalle()
  }, [tab, filtroLocal])

  const toggleRow = (key) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const usuarios = [...new Set(cierres.map(c => c.user_nombre))].sort()
  const filtered = filtroUsuario ? cierres.filter(c => c.user_nombre === filtroUsuario) : cierres

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Cierres de Caja</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {[['consolidado', 'Consolidado'], ['detalle', 'Detalle por cajero']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Consolidado */}
      {tab === 'consolidado' && (
        <div>
          <div className="flex flex-wrap gap-3 mb-6 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Desde</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="border rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Hasta</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="border rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Local</label>
              <select value={localConsolidado} onChange={e => setLocalConsolidado(e.target.value)}
                className="border rounded px-3 py-2 text-sm">
                <option value="">Todos los locales</option>
                {locals.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>
            <button onClick={loadConsolidado}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
              Buscar
            </button>
          </div>

          {loadingConsolidado ? (
            <div className="flex items-center gap-2 text-gray-500 py-8">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Cargando...
            </div>
          ) : consolidado.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-3 text-sm">
              No hay cierres registrados para este período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white rounded-xl shadow">
                <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Sucursal</th>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-right">Cajeros</th>
                    <th className="px-4 py-3 text-right">Cierres</th>
                    <th className="px-4 py-3 text-right">Total Cajeros</th>
                    <th className="px-4 py-3 text-right">Total POS</th>
                    <th className="px-4 py-3 text-right">Diferencia</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {consolidado.map(row => {
                    const key = `${row.fecha}-${row.local_id}`
                    const ok = Math.abs(row.diferencia) < 1
                    const expanded = expandedRows.has(key)
                    return (
                      <>
                        <tr key={key} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{row.local_nombre}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {fmtDate(row.fecha)}
                          </td>
                          <td className="px-4 py-3 text-right">{row.num_cajeros}</td>
                          <td className="px-4 py-3 text-right">{row.num_cierres}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.total_cajeros)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.total_pos)}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${ok ? 'text-green-600' : 'text-red-600'}`}>
                            {row.diferencia >= 0 ? '+' : ''}{fmt(row.diferencia)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {ok ? 'OK' : 'Diferencia'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => toggleRow(key)}
                              className="text-xs text-blue-600 hover:underline">
                              {expanded ? 'Ocultar' : 'Ver detalle'}
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${key}-detail`}>
                            <td colSpan={9} className="bg-gray-50 px-6 py-3">
                              <table className="w-full text-xs">
                                <thead className="text-gray-500 uppercase">
                                  <tr>
                                    <th className="py-1 text-left">Cajero</th>
                                    <th className="py-1 text-right">Ventas Sistema</th>
                                    <th className="py-1 text-right">Total Sistema</th>
                                    <th className="py-1 text-right">Total Declarado</th>
                                    <th className="py-1 text-right">Diferencia</th>
                                    <th className="py-1 text-left pl-4">Notas</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {row.cajeros.map(c => {
                                    const diff = Number(c.declarado_total || 0) - Number(c.monto_total || 0)
                                    const cOk = Math.abs(diff) < 1
                                    return (
                                      <tr key={c.id} className={cOk ? 'text-green-700' : 'text-red-700'}>
                                        <td className="py-1.5 font-medium">{c.user_nombre}</td>
                                        <td className="py-1.5 text-right text-gray-700">{c.total_ventas}</td>
                                        <td className="py-1.5 text-right text-gray-700">{fmt(c.monto_total)}</td>
                                        <td className="py-1.5 text-right">{fmt(c.declarado_total)}</td>
                                        <td className={`py-1.5 text-right font-semibold`}>
                                          {diff >= 0 ? '+' : ''}{fmt(diff)}
                                        </td>
                                        <td className="py-1.5 pl-4 text-gray-500">{c.notas || '—'}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Detalle por cajero */}
      {tab === 'detalle' && (
        <div>
          <div className="flex gap-4 mb-6">
            <select className="border rounded px-3 py-2 text-sm" value={filtroLocal}
              onChange={e => { setFiltroLocal(e.target.value); setFiltroUsuario('') }}>
              <option value="">Todos los locales</option>
              {locals.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <select className="border rounded px-3 py-2 text-sm" value={filtroUsuario}
              onChange={e => setFiltroUsuario(e.target.value)}>
              <option value="">Todos los cajeros</option>
              {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">No hay cierres registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white rounded-xl shadow">
                <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Local</th>
                    <th className="px-4 py-3 text-left">Cajero</th>
                    <th className="px-4 py-3 text-right">Ventas</th>
                    <th className="px-4 py-3 text-right">Total Sistema</th>
                    <th className="px-4 py-3 text-right">Total Declarado</th>
                    <th className="px-4 py-3 text-right">Diferencia</th>
                    <th className="px-4 py-3 text-left">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(c => {
                    const diff = Number(c.declarado_total || 0) - Number(c.monto_total || 0)
                    const diffColor = Math.abs(diff) < 1 ? 'text-green-600' : 'text-red-600'
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {fmtDate(c.fecha)}
                        </td>
                        <td className="px-4 py-3">{c.local_nombre}</td>
                        <td className="px-4 py-3 font-medium">{c.user_nombre}</td>
                        <td className="px-4 py-3 text-right">{c.total_ventas}</td>
                        <td className="px-4 py-3 text-right">{fmt(c.monto_total)}</td>
                        <td className="px-4 py-3 text-right">{fmt(c.declarado_total)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${diffColor}`}>
                          {diff >= 0 ? '+' : ''}{fmt(diff)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.notas || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-2">{filtered.length} cierre{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
