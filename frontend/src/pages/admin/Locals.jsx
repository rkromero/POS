import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const EMPTY = { nombre: '', direccion: '', telefono: '', logo_url: '', activo: true }

export default function AdminLocals() {
  const [locals, setLocals] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = async () => {
    try {
      const res = await api.get(`/locals?page=${page}&limit=20`)
      setLocals(res.data.data)
      setTotal(res.data.total)
    } catch { toast.error('Error al cargar locales') }
  }

  useEffect(() => { load() }, [page])

  const openCreate = () => { setForm(EMPTY); setEditing(null); setShowModal(true) }
  const openEdit = (l) => {
    setForm({ nombre: l.nombre, direccion: l.direccion || '', telefono: l.telefono || '', logo_url: l.logo_url || '', activo: l.activo })
    setEditing(l.id)
    setShowModal(true)
  }

  const save = async (e) => {
    e.preventDefault()
    try {
      if (editing) { await api.put(`/locals/${editing}`, form); toast.success('Local actualizado') }
      else { await api.post('/locals', form); toast.success('Local creado') }
      setShowModal(false)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar') }
  }

  const remove = async (id) => {
    if (!confirm('¿Eliminar este local?')) return
    try { await api.delete(`/locals/${id}`); toast.success('Local eliminado'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'No se puede eliminar este local') }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#111111]">Locales</h1>
        <button onClick={openCreate} className="btn-primary">+ Nuevo local</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mimi-50">
              <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Nombre</th>
              <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Dirección</th>
              <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Teléfono</th>
              <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Estado</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {locals.map((l, i) => (
              <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-3 px-4 font-medium">{l.nombre}</td>
                <td className="py-3 px-4 text-[#444444]">{l.direccion || '—'}</td>
                <td className="py-3 px-4 text-[#444444]">{l.telefono || '—'}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${l.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {l.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right space-x-3">
                  <button onClick={() => openEdit(l)} className="text-mimi-500 hover:underline text-xs font-medium">Editar</button>
                  <button onClick={() => remove(l.id)} className="text-red-500 hover:underline text-xs font-medium">Eliminar</button>
                </td>
              </tr>
            ))}
            {locals.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-[#444444]">No hay locales registrados</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar local' : 'Nuevo local'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input className="input-field" value={form.nombre} onChange={e => set('nombre', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Dirección</label>
                <input className="input-field" value={form.direccion} onChange={e => set('direccion', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input className="input-field" value={form.telefono} onChange={e => set('telefono', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Logo URL</label>
                <input className="input-field" value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://..." />
              </div>
              {editing && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={e => set('activo', e.target.checked)} className="rounded" />
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
