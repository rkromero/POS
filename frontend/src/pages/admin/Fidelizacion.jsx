import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
const fmtPts = (v) => parseInt(v || 0).toLocaleString('es-AR')
const parseTS = (v) => v ? new Date(String(v).replace(' ', 'T').replace(/(\+\d{2})$/, '$1:00')) : new Date('invalid')

const NIVEL_BADGE = { Bronce: 'bg-amber-100 text-amber-700', Plata: 'bg-slate-100 text-slate-600', Oro: 'bg-yellow-100 text-yellow-600' }
const TIPO_BADGE = { acumulacion: 'bg-green-100 text-green-700', canje: 'bg-blue-100 text-blue-700', ajuste_manual: 'bg-purple-100 text-purple-700', anulacion: 'bg-red-100 text-red-700', vencimiento: 'bg-gray-100 text-gray-500' }
const TIPO_LABEL = { acumulacion: 'Acumulación', canje: 'Canje', ajuste_manual: 'Ajuste manual', anulacion: 'Anulación', vencimiento: 'Vencimiento' }

export default function Fidelizacion() {
  const [tab, setTab] = useState('dashboard')

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'clientes', label: 'Clientes' },
    { id: 'movimientos', label: 'Movimientos' },
    { id: 'config', label: 'Configuración' },
    { id: 'beneficios', label: 'Beneficios' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#111111]">Fidelización por Puntos</h1>
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === t.id ? 'bg-mimi-500 text-white' : 'bg-white border border-[#E5E7EB] text-[#444444] hover:bg-gray-50'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'dashboard' && <Dashboard />}
      {tab === 'clientes' && <Clientes />}
      {tab === 'movimientos' && <Movimientos />}
      {tab === 'config' && <Configuracion />}
      {tab === 'beneficios' && <Beneficios />}
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function Dashboard() {
  const [data, setData] = useState(null)
  useEffect(() => { api.get('/loyalty/dashboard').then(r => setData(r.data)).catch(() => toast.error('Error')) }, [])
  if (!data) return <p className="text-center py-12 text-[#444444]">Cargando...</p>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Clientes', val: fmtPts(data.total_clientes), icon: '👥' },
          { label: 'Puntos vigentes', val: fmtPts(data.total_puntos_vigentes), icon: '⭐' },
          { label: 'Puntos hoy', val: fmtPts(data.puntos_hoy), icon: '📈' },
          { label: 'Sin compras 30d', val: fmtPts(data.sin_compras_30_dias), icon: '💤' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-[#444444] font-medium uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold text-[#111111] mt-1">{s.icon} {s.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-bold uppercase tracking-wide">Top 5 clientes</h2>
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {data.top_clientes.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-lg font-bold text-[#AAAAAA] w-6">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#111111]">{c.nombre}</p>
                  <p className="text-xs text-[#444444]">{c.whatsapp || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-mimi-500">{fmtPts(c.puntos_vigentes)} pts</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${NIVEL_BADGE[c.nivel] || 'bg-gray-100 text-gray-600'}`}>{c.nivel}</span>
                </div>
              </div>
            ))}
            {data.top_clientes.length === 0 && <p className="text-center py-6 text-sm text-[#444444]">Sin datos aún</p>}
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-bold uppercase tracking-wide">Puntos otorgados — últimos 7 días</h2>
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {data.movimientos_7dias.length === 0 && <p className="text-center py-6 text-sm text-[#444444]">Sin actividad</p>}
            {data.movimientos_7dias.map(d => (
              <div key={d.fecha} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm text-[#444444]">{new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="text-sm font-bold text-green-600">+{fmtPts(d.otorgados)} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Clientes ───────────────────────────────────────────────────────────────
function Clientes() {
  const [clientes, setClientes] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [ajusteForm, setAjusteForm] = useState({ puntos: '', notas: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/loyalty/clientes?search=${search}&page=${page}&limit=30`)
      setClientes(r.data.data); setTotal(r.data.total)
    } catch { toast.error('Error al cargar clientes') }
  }, [search, page])

  useEffect(() => { load() }, [load])

  const openDetail = async (c) => {
    const r = await api.get(`/loyalty/clientes/${c.id}`)
    setSelected(r.data)
  }

  const handleAjuste = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await api.post(`/loyalty/clientes/${selected.id}/ajuste`, ajusteForm)
      setSelected(prev => ({ ...prev, ...r.data }))
      setAjusteForm({ puntos: '', notas: '' })
      toast.success('Puntos ajustados')
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
    finally { setSaving(false) }
  }

  if (selected) return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => setSelected(null)} className="text-mimi-500 text-sm hover:underline">← Volver</button>
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{selected.nombre}</h2>
            <p className="text-sm text-[#444444]">{selected.whatsapp && `📱 ${selected.whatsapp}`} {selected.email && `· ✉️ ${selected.email}`}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-mimi-500">{fmtPts(selected.puntos_vigentes)} pts</p>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${NIVEL_BADGE[selected.nivel] || ''}`}>{selected.nivel}</span>
          </div>
        </div>
        <p className="text-xs text-[#444444] mt-1">Total histórico: {fmtPts(selected.puntos_total_historico)} pts</p>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide mb-3">Ajuste manual de puntos</h3>
        <form onSubmit={handleAjuste} className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-[#444444] mb-1 block">Puntos (positivo = sumar, negativo = restar)</label>
            <input type="number" className="input-field text-sm" placeholder="ej: 500 o -200" value={ajusteForm.puntos} onChange={e => setAjusteForm(f => ({ ...f, puntos: e.target.value }))} required />
          </div>
          <div className="flex-1">
            <label className="text-xs text-[#444444] mb-1 block">Motivo</label>
            <input className="input-field text-sm" placeholder="Motivo del ajuste" value={ajusteForm.notas} onChange={e => setAjusteForm(f => ({ ...f, notas: e.target.value }))} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary py-2.5 px-4 shrink-0">Aplicar</button>
        </form>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7EB]">
          <h3 className="text-sm font-bold uppercase tracking-wide">Movimientos</h3>
        </div>
        <div className="divide-y divide-[#E5E7EB] max-h-80 overflow-auto">
          {selected.movimientos?.map(m => (
            <div key={m.id} className="flex items-center justify-between px-5 py-2.5">
              <div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium mr-2 ${TIPO_BADGE[m.tipo] || ''}`}>{TIPO_LABEL[m.tipo]}</span>
                <span className="text-xs text-[#444444]">{m.notas || m.beneficio_nombre || ''}</span>
                <p className="text-xs text-[#AAAAAA] mt-0.5">{parseTS(m.created_at).toLocaleDateString('es-AR')}</p>
              </div>
              <span className={`text-sm font-bold ${m.puntos > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {m.puntos > 0 ? '+' : ''}{fmtPts(m.puntos)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className="input-field flex-1" placeholder="Buscar por nombre, WhatsApp o email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mimi-50">
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Cliente</th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Contacto</th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Nivel</th>
              <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Puntos vigentes</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c, i) => (
              <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-3 px-4 font-medium text-[#111111]">{c.nombre}</td>
                <td className="py-3 px-4 text-[#444444] text-xs">{c.whatsapp && `📱 ${c.whatsapp}`}{c.whatsapp && c.email && ' · '}{c.email && `✉️ ${c.email}`}</td>
                <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${NIVEL_BADGE[c.nivel] || ''}`}>{c.nivel}</span></td>
                <td className="py-3 px-4 text-right font-bold text-mimi-500">{fmtPts(c.puntos_vigentes)}</td>
                <td className="py-3 px-4 text-right"><button onClick={() => openDetail(c)} className="text-mimi-500 hover:underline text-xs font-medium">Ver detalle</button></td>
              </tr>
            ))}
            {clientes.length === 0 && <tr><td colSpan="5" className="text-center py-10 text-[#444444]">No hay clientes registrados aún</td></tr>}
          </tbody>
        </table>
      </div>
      {total > 30 && (
        <div className="flex justify-between items-center text-sm text-[#444444]">
          <span>{total} clientes</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-xs">Anterior</button>
            <button disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-xs">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Movimientos ────────────────────────────────────────────────────────────
function Movimientos() {
  const [movs, setMovs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  useEffect(() => {
    api.get(`/loyalty/movimientos?page=${page}&limit=30`)
      .then(r => { setMovs(r.data.data); setTotal(r.data.total) })
      .catch(() => toast.error('Error'))
  }, [page])

  return (
    <div className="space-y-4">
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mimi-50">
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Fecha</th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Cliente</th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Tipo</th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Detalle</th>
              <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {movs.map((m, i) => (
              <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-3 px-4 text-xs text-[#444444]">{parseTS(m.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="py-3 px-4 font-medium">{m.cliente_nombre}</td>
                <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_BADGE[m.tipo] || ''}`}>{TIPO_LABEL[m.tipo]}</span></td>
                <td className="py-3 px-4 text-xs text-[#444444]">{m.beneficio_nombre || m.notas || (m.sale_id ? `Venta #${m.sale_id}` : '—')}</td>
                <td className={`py-3 px-4 text-right font-bold text-sm ${m.puntos > 0 ? 'text-green-600' : 'text-red-500'}`}>{m.puntos > 0 ? '+' : ''}{fmtPts(m.puntos)}</td>
              </tr>
            ))}
            {movs.length === 0 && <tr><td colSpan="5" className="text-center py-10 text-[#444444]">Sin movimientos aún</td></tr>}
          </tbody>
        </table>
      </div>
      {total > 30 && (
        <div className="flex justify-between items-center text-sm text-[#444444]">
          <span>{total} movimientos</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-xs">Anterior</button>
            <button disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-xs">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Configuración ──────────────────────────────────────────────────────────
function Configuracion() {
  const [config, setConfig] = useState(null)
  const [levels, setLevels] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/loyalty/config'), api.get('/loyalty/levels')])
      .then(([c, l]) => { setConfig(c.data); setLevels(l.data) })
      .catch(() => toast.error('Error al cargar configuración'))
  }, [])

  const saveConfig = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const r = await api.put('/loyalty/config', config)
      setConfig(r.data); toast.success('Configuración guardada')
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
    finally { setSaving(false) }
  }

  const saveLevels = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const r = await api.put('/loyalty/levels', { levels })
      setLevels(r.data); toast.success('Niveles guardados')
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
    finally { setSaving(false) }
  }

  if (!config) return <p className="text-center py-12 text-[#444444]">Cargando...</p>

  return (
    <div className="space-y-5 max-w-xl">
      <div className="card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-4">Reglas de acumulación</h2>
        <form onSubmit={saveConfig} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Puntos por</label>
              <input type="number" min="1" className="input-field" value={config.puntos_por_monto} onChange={e => setConfig(c => ({ ...c, puntos_por_monto: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Cada $ gastados</label>
              <input type="number" min="1" className="input-field" value={config.monto_base} onChange={e => setConfig(c => ({ ...c, monto_base: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-[#444444] bg-mimi-50 rounded-xl px-3 py-2">
            Ejemplo: por cada ${parseFloat(config.monto_base || 0).toLocaleString('es-AR')} en compras, el cliente recibe {parseInt(config.puntos_por_monto || 0).toLocaleString('es-AR')} puntos
          </p>
          <div>
            <label className="text-sm font-medium mb-1 block">Vencimiento de puntos (meses)</label>
            <input type="number" min="1" max="60" className="input-field w-32" value={config.vencimiento_meses} onChange={e => setConfig(c => ({ ...c, vencimiento_meses: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded" checked={config.activo} onChange={e => setConfig(c => ({ ...c, activo: e.target.checked }))} />
            <span className="text-sm">Sistema de fidelización activo</span>
          </label>
          <button type="submit" disabled={saving} className="btn-primary w-full">Guardar configuración</button>
        </form>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-4">Niveles de fidelización</h2>
        <form onSubmit={saveLevels} className="space-y-3">
          {levels.map((l, i) => (
            <div key={l.id} className="flex items-center gap-3">
              <input className="input-field flex-1" value={l.nombre} onChange={e => setLevels(ls => ls.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} placeholder="Nombre del nivel" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#444444]">desde</span>
                <input type="number" min="0" className="input-field w-28" value={l.puntos_minimos} onChange={e => setLevels(ls => ls.map((x, j) => j === i ? { ...x, puntos_minimos: e.target.value } : x))} />
                <span className="text-xs text-[#444444]">pts</span>
              </div>
            </div>
          ))}
          <button type="submit" disabled={saving} className="btn-primary w-full">Guardar niveles</button>
        </form>
      </div>
    </div>
  )
}

// ── Beneficios ─────────────────────────────────────────────────────────────
function Beneficios() {
  const [beneficios, setBeneficios] = useState([])
  const [form, setForm] = useState({ nombre: '', tipo: 'descuento', puntos_necesarios: '', descripcion: '', activo: true })
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const load = () => api.get('/loyalty/beneficios').then(r => setBeneficios(r.data)).catch(() => toast.error('Error'))
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm({ nombre: '', tipo: 'descuento', puntos_necesarios: '', descripcion: '', activo: true }); setEditing(null); setShowModal(true) }
  const openEdit = (b) => { setForm({ nombre: b.nombre, tipo: b.tipo, puntos_necesarios: b.puntos_necesarios, descripcion: b.descripcion || '', activo: b.activo }); setEditing(b.id); setShowModal(true) }

  const save = async (e) => {
    e.preventDefault()
    try {
      if (editing) { await api.put(`/loyalty/beneficios/${editing}`, form); toast.success('Beneficio actualizado') }
      else { await api.post('/loyalty/beneficios', form); toast.success('Beneficio creado') }
      setShowModal(false); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
  }

  const TIPO_LABEL_B = { descuento: 'Descuento', producto: 'Producto gratis', envio_gratis: 'Envío gratis' }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-primary">+ Nuevo beneficio</button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mimi-50">
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Beneficio</th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Tipo</th>
              <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Puntos necesarios</th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#444444]">Estado</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {beneficios.map((b, i) => (
              <tr key={b.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-3 px-4 font-medium">{b.nombre}<br />{b.descripcion && <span className="text-xs text-[#444444]">{b.descripcion}</span>}</td>
                <td className="py-3 px-4 text-[#444444]">{TIPO_LABEL_B[b.tipo]}</td>
                <td className="py-3 px-4 text-right font-bold text-mimi-500">{fmtPts(b.puntos_necesarios)}</td>
                <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{b.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td className="py-3 px-4 text-right"><button onClick={() => openEdit(b)} className="text-mimi-500 hover:underline text-xs font-medium">Editar</button></td>
              </tr>
            ))}
            {beneficios.length === 0 && <tr><td colSpan="5" className="text-center py-10 text-[#444444]">No hay beneficios configurados</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar beneficio' : 'Nuevo beneficio'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Nombre *</label>
                <input className="input-field" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Tipo *</label>
                  <select className="input-field" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="descuento">Descuento</option>
                    <option value="producto">Producto gratis</option>
                    <option value="envio_gratis">Envío gratis</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Puntos necesarios *</label>
                  <input type="number" min="1" className="input-field" value={form.puntos_necesarios} onChange={e => setForm(f => ({ ...f, puntos_necesarios: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Descripción</label>
                <input className="input-field" placeholder="ej: 10% de descuento en tu próxima compra" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              {editing && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                  <span className="text-sm">Activo</span>
                </label>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">Guardar</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
