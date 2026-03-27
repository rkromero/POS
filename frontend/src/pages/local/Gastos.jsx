import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

const TIPOS = ['Mercaderia', 'Sueldo', 'Vales', 'Servicios', 'Otros']
const ABONADO = ['Efectivo Caja', 'Transferencia']

const EMPTY = { tipo: 'Mercaderia', descripcion: '', monto: '', abonado_con: 'Efectivo Caja' }

const TIPO_COLORS = {
  Mercaderia: 'bg-blue-100 text-blue-700',
  Sueldo: 'bg-purple-100 text-purple-700',
  Vales: 'bg-orange-100 text-orange-700',
  Servicios: 'bg-teal-100 text-teal-700',
  Otros: 'bg-gray-100 text-gray-600',
}

export default function Gastos() {
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [gastos, setGastos] = useState([])
  const [totales, setTotales] = useState({ total: 0, total_efectivo: 0, total_transferencia: 0 })
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [fecha])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get(`/gastos?fecha=${fecha}`)
      setGastos(res.data.gastos)
      setTotales({ total: res.data.total, total_efectivo: res.data.total_efectivo, total_transferencia: res.data.total_transferencia })
    } catch { toast.error('Error al cargar gastos') }
    finally { setLoading(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.monto || parseFloat(form.monto) <= 0) {
      toast.error('Ingresá un monto válido')
      return
    }
    setSaving(true)
    try {
      await api.post('/gastos', { ...form, fecha })
      toast.success('Gasto registrado')
      setForm(EMPTY)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrar gasto')
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este gasto?')) return
    try {
      await api.delete(`/gastos/${id}`)
      toast.success('Gasto eliminado')
      load()
    } catch { toast.error('Error al eliminar') }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const fechaLabel = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-xl font-bold text-[#111111]">Gastos</h1>

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

      {/* Formulario nuevo gasto */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wide mb-4">Registrar gasto</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo *</label>
              <select
                className="input-field text-sm"
                value={form.tipo}
                onChange={e => set('tipo', e.target.value)}
              >
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Abonado con *</label>
              <select
                className="input-field text-sm"
                value={form.abonado_con}
                onChange={e => set('abonado_con', e.target.value)}
              >
                {ABONADO.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <input
              className="input-field text-sm"
              placeholder="Detalle del gasto (opcional)"
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Monto *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#444444]">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                className="input-field pl-7 text-sm"
                value={form.monto}
                onChange={e => set('monto', e.target.value)}
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full py-2.5"
          >
            {saving ? 'Registrando...' : '+ Registrar gasto'}
          </button>
        </form>
      </div>

      {/* Resumen del día */}
      {(gastos.length > 0 || !loading) && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 col-span-1">
            <p className="text-xs text-[#444444] font-medium uppercase tracking-wide">Total gastos</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{fmt(totales.total)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-[#444444] font-medium uppercase tracking-wide">Efectivo Caja</p>
            <p className="text-xl font-bold text-[#111111] mt-1">{fmt(totales.total_efectivo)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-[#444444] font-medium uppercase tracking-wide">Transferencia</p>
            <p className="text-xl font-bold text-[#111111] mt-1">{fmt(totales.total_transferencia)}</p>
          </div>
        </div>
      )}

      {/* Lista de gastos */}
      {loading ? (
        <p className="text-center text-[#444444] py-8">Cargando...</p>
      ) : gastos.length === 0 ? (
        <div className="card p-6 text-center text-[#444444] text-sm">
          No hay gastos registrados para este día
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wide">
              Gastos del día ({gastos.length})
            </h2>
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {gastos.map(g => (
              <div key={g.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${TIPO_COLORS[g.tipo] || 'bg-gray-100 text-gray-600'}`}>
                    {g.tipo}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#111111] truncate">
                      {g.descripcion || <span className="text-[#AAAAAA] italic">Sin descripción</span>}
                    </p>
                    <p className="text-xs text-[#444444]">
                      {g.abonado_con} · {g.user_nombre}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold text-red-500">{fmt(g.monto)}</span>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="text-[#AAAAAA] hover:text-red-500 transition-colors text-xs"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
