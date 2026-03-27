import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const EMPTY_LOCAL = { nombre: '', direccion: '', telefono: '', logo_url: '', activo: true }
const EMPTY_USER = { nombre: '', email: '', password: '', role: 'local', activo: true }

export default function AdminLocals() {
  const [locals, setLocals] = useState([])
  const [form, setForm] = useState(EMPTY_LOCAL)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  // Modal de usuarios por local
  const [usersModal, setUsersModal] = useState(null) // local seleccionado
  const [localUsers, setLocalUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userForm, setUserForm] = useState(EMPTY_USER)
  const [editingUser, setEditingUser] = useState(null)
  const [showUserForm, setShowUserForm] = useState(false)

  const load = async () => {
    try {
      const res = await api.get(`/locals?page=${page}&limit=20`)
      setLocals(res.data.data)
      setTotal(res.data.total)
    } catch { toast.error('Error al cargar locales') }
  }

  useEffect(() => { load() }, [page])

  const openCreate = () => { setForm(EMPTY_LOCAL); setEditing(null); setShowModal(true) }
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

  // ── Gestión de usuarios por local ──
  const openUsersModal = async (local) => {
    setUsersModal(local)
    setShowUserForm(false)
    setEditingUser(null)
    setLoadingUsers(true)
    try {
      const res = await api.get(`/users?local_id=${local.id}&limit=100`)
      setLocalUsers(res.data.data)
    } catch { toast.error('Error al cargar usuarios') }
    finally { setLoadingUsers(false) }
  }

  const openNewUser = () => {
    setUserForm(EMPTY_USER)
    setEditingUser(null)
    setShowUserForm(true)
  }

  const openEditUser = (u) => {
    setUserForm({ nombre: u.nombre, email: u.email, password: '', role: u.role, activo: u.activo })
    setEditingUser(u.id)
    setShowUserForm(true)
  }

  const saveUser = async (e) => {
    e.preventDefault()
    const data = { ...userForm, local_id: usersModal.id }
    if (!data.password) delete data.password
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser}`, data)
        toast.success('Usuario actualizado')
      } else {
        await api.post('/users', data)
        toast.success('Usuario creado')
      }
      setShowUserForm(false)
      const res = await api.get(`/users?local_id=${usersModal.id}&limit=100`)
      setLocalUsers(res.data.data)
    } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar usuario') }
  }

  const deactivateUser = async (id) => {
    if (!confirm('¿Desactivar este usuario?')) return
    try {
      await api.delete(`/users/${id}`)
      const res = await api.get(`/users?local_id=${usersModal.id}&limit=100`)
      setLocalUsers(res.data.data)
      toast.success('Usuario desactivado')
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
  }

  const setU = (k, v) => setUserForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#111111]">Sucursales</h1>
        <button onClick={openCreate} className="btn-primary">+ Nueva sucursal</button>
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
                  <button onClick={() => openUsersModal(l)} className="text-blue-500 hover:underline text-xs font-medium">Usuarios</button>
                  <button onClick={() => openEdit(l)} className="text-mimi-500 hover:underline text-xs font-medium">Editar</button>
                  <button onClick={() => remove(l.id)} className="text-red-500 hover:underline text-xs font-medium">Eliminar</button>
                </td>
              </tr>
            ))}
            {locals.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-[#444444]">No hay sucursales registradas</td></tr>}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="flex justify-between items-center mt-4 text-sm text-[#444444]">
          <span>{total} sucursales</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-xs">Anterior</button>
            <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-xs">Siguiente</button>
          </div>
        </div>
      )}

      {/* Modal crear/editar sucursal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar sucursal' : 'Nueva sucursal'}</h2>
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

      {/* Modal usuarios de la sucursal */}
      {usersModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">Usuarios — {usersModal.nombre}</h2>
                <p className="text-xs text-[#444444]">Cajeras y encargados de esta sucursal</p>
              </div>
              <button onClick={() => setUsersModal(null)} className="text-[#444444] hover:text-[#111111] text-xl leading-none">✕</button>
            </div>

            {!showUserForm ? (
              <>
                <button onClick={openNewUser} className="btn-primary mb-3 self-start">+ Agregar usuario</button>
                {loadingUsers ? (
                  <p className="text-sm text-[#444444] py-4 text-center">Cargando...</p>
                ) : localUsers.length === 0 ? (
                  <p className="text-sm text-[#444444] py-4 text-center">No hay usuarios en esta sucursal</p>
                ) : (
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-mimi-50">
                          <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-[#444444]">Nombre</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-[#444444]">Email</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-[#444444]">Estado</th>
                          <th className="py-2 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {localUsers.map((u, i) => (
                          <tr key={u.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="py-2 px-3 font-medium">{u.nombre}</td>
                            <td className="py-2 px-3 text-[#444444] text-xs">{u.email}</td>
                            <td className="py-2 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {u.activo ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right space-x-3">
                              <button onClick={() => openEditUser(u)} className="text-mimi-500 hover:underline text-xs font-medium">Editar</button>
                              <button onClick={() => deactivateUser(u.id)} className="text-red-500 hover:underline text-xs font-medium">Desactivar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              /* Formulario de usuario */
              <form onSubmit={saveUser} className="space-y-3 overflow-auto flex-1">
                <h3 className="font-semibold text-[#111111]">{editingUser ? 'Editar usuario' : 'Nuevo usuario'}</h3>
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre *</label>
                  <input className="input-field" value={userForm.nombre} onChange={e => setU('nombre', e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input type="email" className="input-field" value={userForm.email} onChange={e => setU('email', e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Contraseña {editingUser && <span className="text-[#444444] font-normal">(dejar vacío para no cambiar)</span>}
                  </label>
                  <input type="password" className="input-field" value={userForm.password} onChange={e => setU('password', e.target.value)} required={!editingUser} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rol *</label>
                  <select className="input-field" value={userForm.role} onChange={e => setU('role', e.target.value)}>
                    <option value="local">Usuario de Local</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                {editingUser && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={userForm.activo} onChange={e => setU('activo', e.target.checked)} className="rounded" />
                    <span className="text-sm">Activo</span>
                  </label>
                )}
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="btn-primary flex-1">Guardar</button>
                  <button type="button" onClick={() => setShowUserForm(false)} className="btn-secondary flex-1">Cancelar</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
