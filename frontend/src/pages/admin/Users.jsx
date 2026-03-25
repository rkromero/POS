import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const EMPTY = { nombre: '', email: '', password: '', role: 'local', local_id: '', activo: true }

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [locals, setLocals] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = async () => {
    try {
      const [ur, lr] = await Promise.all([
        api.get(`/users?page=${page}&limit=20`),
        api.get('/locals?limit=100'),
      ])
      setUsers(ur.data.data)
      setTotal(ur.data.total)
      setLocals(lr.data.data)
    } catch { toast.error('Error al cargar usuarios') }
  }

  useEffect(() => { load() }, [page])

  const openCreate = () => { setForm(EMPTY); setEditing(null); setShowModal(true) }
  const openEdit = (u) => {
    setForm({ nombre: u.nombre, email: u.email, password: '', role: u.role, local_id: u.local_id || '', activo: u.activo })
    setEditing(u.id)
    setShowModal(true)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async (e) => {
    e.preventDefault()
    const data = { ...form, local_id: form.local_id || null }
    if (!data.password) delete data.password
    try {
      if (editing) { await api.put(`/users/${editing}`, data); toast.success('Usuario actualizado') }
      else { await api.post('/users', data); toast.success('Usuario creado') }
      setShowModal(false)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar') }
  }

  const remove = async (id) => {
    if (!confirm('¿Desactivar este usuario? Podrá reactivarlo editándolo.')) return
    try { await api.delete(`/users/${id}`); toast.success('Usuario desactivado'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Error al desactivar') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#111111]">Usuarios</h1>
        <button onClick={openCreate} className="btn-primary">+ Nuevo usuario</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mimi-50">
              {['Nombre','Email','Rol','Local','Estado',''].map((h,i) => (
                <th key={i} className={`py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444] ${i >= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-3 px-4 font-medium">{u.nombre}</td>
                <td className="py-3 px-4 text-[#444444]">{u.email}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-mimi-50 text-mimi-500'}`}>
                    {u.role === 'admin' ? 'Admin' : 'Local'}
                  </span>
                </td>
                <td className="py-3 px-4 text-[#444444]">{u.local_nombre || '—'}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right space-x-3">
                  <button onClick={() => openEdit(u)} className="text-mimi-500 hover:underline text-xs font-medium">Editar</button>
                  <button onClick={() => remove(u.id)} className="text-red-500 hover:underline text-xs font-medium">Desactivar</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-[#444444]">No hay usuarios</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4 text-sm text-[#444444]">
        <span>{total} usuarios</span>
        <div className="flex gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="btn-secondary py-1 px-3 text-xs">Anterior</button>
          <button disabled={page * 20 >= total} onClick={() => setPage(p => p+1)} className="btn-secondary py-1 px-3 text-xs">Siguiente</button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar usuario' : 'Nuevo usuario'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input className="input-field" value={form.nombre} onChange={e => set('nombre', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input type="email" className="input-field" value={form.email} onChange={e => set('email', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Contraseña {editing && <span className="text-[#444444] font-normal">(dejar vacío para no cambiar)</span>}
                </label>
                <input type="password" className="input-field" value={form.password} onChange={e => set('password', e.target.value)} required={!editing} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rol *</label>
                <select className="input-field" value={form.role} onChange={e => set('role', e.target.value)}>
                  <option value="local">Usuario de Local</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {form.role === 'local' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Local *</label>
                  <select className="input-field" value={form.local_id} onChange={e => set('local_id', e.target.value)} required>
                    <option value="">Seleccionar local...</option>
                    {locals.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
              )}
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
