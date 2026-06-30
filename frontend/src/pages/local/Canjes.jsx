import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmtDateTime = (d) => new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

const TABS = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'entregado', label: 'Entregados' },
  { key: '', label: 'Todos' },
]

export default function Canjes() {
  const [canjes, setCanjes] = useState([])
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState('pendiente')
  const [search, setSearch] = useState('')
  const [marcando, setMarcando] = useState(null)

  const fetchCanjes = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (estado) params.set('estado', estado)
      if (search.trim()) params.set('search', search.trim())
      const res = await api.get(`/loyalty/canjes?${params}`)
      setCanjes(res.data)
    } catch { toast.error('Error al cargar canjes') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    const t = setTimeout(fetchCanjes, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, search])

  async function marcarEntregado(c) {
    if (!window.confirm(`¿Marcar como ENTREGADO el canje de "${c.beneficio_nombre}" a ${c.cliente_nombre || 'cliente'}?`)) return
    setMarcando(c.id)
    try {
      const res = await api.patch(`/loyalty/canjes/${c.id}/entregar`)
      toast.success('Canje marcado como entregado')
      setCanjes(prev => estado === 'pendiente'
        ? prev.filter(x => x.id !== c.id)
        : prev.map(x => x.id === c.id ? res.data : x))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al marcar entregado')
      fetchCanjes()
    } finally {
      setMarcando(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 gap-y-2 mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-[#111111]">Canjes</h1>
        <input
          className="input-field w-full sm:w-64 text-sm"
          placeholder="Buscar por cliente o teléfono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map(t => (
          <button
            key={t.key || 'todos'}
            onClick={() => setEstado(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              estado === t.key ? 'bg-mimi-500 text-white' : 'bg-white border border-[#E5E7EB] text-[#444444] hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-[#444444] py-12">Cargando...</p>
      ) : canjes.length === 0 ? (
        <p className="text-center text-[#444444] py-12">
          {estado === 'pendiente' ? 'No hay canjes pendientes de entrega' : 'No hay canjes'}
        </p>
      ) : (
        <div className="space-y-3">
          {canjes.map(c => {
            const entregado = !!c.entregado_at
            return (
              <div key={c.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#111111]">{c.beneficio_nombre || 'Beneficio'}</p>
                      {c.beneficio_tipo && (
                        <span className="text-xs bg-mimi-50 text-mimi-500 px-2 py-0.5 rounded-full font-medium capitalize">
                          {c.beneficio_tipo}
                        </span>
                      )}
                      <span className="text-xs text-[#444444] font-semibold">{Math.abs(c.puntos)} pts</span>
                    </div>
                    {c.beneficio_descripcion && (
                      <p className="text-sm text-[#444444] mt-0.5">{c.beneficio_descripcion}</p>
                    )}
                    <p className="text-sm text-[#111111] mt-2 font-medium">
                      {c.cliente_nombre || 'Cliente'}
                      {c.cliente_whatsapp && <span className="text-[#444444] font-normal"> · {c.cliente_whatsapp}</span>}
                    </p>
                    <p className="text-xs text-[#444444] mt-0.5">
                      Canjeado: {fmtDateTime(c.created_at)} · {c.creado_por_nombre ? `Mostrador (${c.creado_por_nombre})` : 'Web'}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${
                    entregado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {entregado ? 'Entregado' : 'Pendiente'}
                  </span>
                </div>

                {entregado ? (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB] text-xs text-green-700 bg-green-50 rounded-lg p-2">
                    ✓ Entregado el {fmtDateTime(c.entregado_at)}
                    {c.entregado_por_nombre ? ` por ${c.entregado_por_nombre}` : ''}
                    {c.entregado_local_nombre ? ` · ${c.entregado_local_nombre}` : ''}
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                    <button
                      onClick={() => marcarEntregado(c)}
                      disabled={marcando === c.id}
                      className="btn-primary py-2 px-4 text-sm"
                    >
                      {marcando === c.id ? 'Marcando...' : '✓ Marcar entregado'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
