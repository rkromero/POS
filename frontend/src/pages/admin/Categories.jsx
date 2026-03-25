import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ nombre: '', descripcion: '' })
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const load = async () => {
    try { const res = await api.get('/categories'); setCategories(res.data) }
    catch { toast.error('Error al cargar categorías') }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setForm({ nombre: '', descripcion: '' }); setEditing(null); setShowModal(true) }
  const openEdit = (c) => { setForm({ nombre: c.nombre, descripcion: c.descripcion || '' }); setEditing(c.id); setShowModal(true) }

  const save = async (e) => {
    e.preventDefault()
    try {
      if (editing) { await api.put(`/categories/${editing}`, form); toast.success('Categoría actualizada') }
      else { await api.post('/categories', form); toast.success('Categoría creada') }
      setShowModal(false)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
  }

  const remove = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return
    try { await api.delete(`/categories/${id}`); toast.success('Eliminada'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#111111]">Categorías</h1>
        <button onClick={openCreate} className="btn-primary">+ Nueva categoría</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(c => (
          <div key={c.id} className="card flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#111111]">{c.nombre}</p>
              <p className="text-sm text-[#444444] mt-1">{c.descripcion || 'Sin descripción'}</p>
            </div>
            <div className="flex gap-3 ml-4 flex-shrink-0">
              <button onClick={() => openEdit(c)} className="text-mimi-500 hover:underline text-xs font-medium">Editar</button>
              <button onClick={() => remove(c.id)} className="text-red-500 hover:underline text-xs font-medium">Eliminar</button>
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="text-[#444444] py-4">No hay categorías</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Nueva'} categoría</h2>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input className="input-field" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <textarea className="input-field" rows={2} value={form.descripcion} onChange={e => setForm(f => ({...f, descripcion: e.target.value}))} />
              </div>
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
