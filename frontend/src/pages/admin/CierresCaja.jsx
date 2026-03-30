import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export default function AdminCierresCaja() {
  const [cierres, setCierres] = useState([])
  const [locals, setLocals] = useState([])
  const [filtroLocal, setFiltroLocal] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [cr, lr] = await Promise.all([
        api.get('/cash-closings' + (filtroLocal ? `?local_id=${filtroLocal}` : '')),
        api.get('/locals?limit=100'),
      ])
      setCierres(cr.data)
      setLocals(lr.data.data)
    } catch {
      toast.error('Error al cargar cierres de caja')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filtroLocal])

  const usuarios = [...new Set(cierres.map(c => c.user_nombre))].sort()

  const filtered = filtroUsuario
    ? cierres.filter(c => c.user_nombre === filtroUsuario)
    : cierres

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Cierres de Caja</h1>

      {/* Filtros */}
      <div className="flex gap-4 mb-6">
        <select
          className="border rounded px-3 py-2 text-sm"
          value={filtroLocal}
          onChange={e => { setFiltroLocal(e.target.value); setFiltroUsuario('') }}
        >
          <option value="">Todos los locales</option>
          {locals.map(l => (
            <option key={l.id} value={l.id}>{l.nombre}</option>
          ))}
        </select>

        <select
          className="border rounded px-3 py-2 text-sm"
          value={filtroUsuario}
          onChange={e => setFiltroUsuario(e.target.value)}
        >
          <option value="">Todos los cajeros</option>
          {usuarios.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
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
                      {new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
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
  )
}
