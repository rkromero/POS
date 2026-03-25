import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const EMPTY = { nombre: '', descripcion: '', precio: '', categoria_id: '', stock: '0', activo: true, unidad_medida: 'unidad' }
const fmt = (v) => `$${parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      if (search) params.set('search', search)
      if (catFilter) params.set('categoria_id', catFilter)
      const [pr, cr] = await Promise.all([api.get(`/products?${params}`), api.get('/categories')])
      setProducts(pr.data.data)
      setTotal(pr.data.total)
      setCategories(cr.data)
    } catch { toast.error('Error al cargar productos') }
  }

  useEffect(() => { load() }, [page, search, catFilter])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const openCreate = () => { setForm(EMPTY); setEditing(null); setShowModal(true) }
  const openEdit = (p) => {
    setForm({ nombre: p.nombre, descripcion: p.descripcion || '', precio: p.precio, categoria_id: p.categoria_id || '', stock: p.stock, activo: p.activo, unidad_medida: p.unidad_medida || 'unidad' })
    setEditing(p.id)
    setShowModal(true)
  }

  const save = async (e) => {
    e.preventDefault()
    const data = { ...form, precio: parseFloat(form.precio), stock: parseInt(form.stock), categoria_id: form.categoria_id || null, unidad_medida: form.unidad_medida }
    try {
      if (editing) { await api.put(`/products/${editing}`, data); toast.success('Producto actualizado') }
      else { await api.post('/products', data); toast.success('Producto creado') }
      setShowModal(false)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
  }

  const remove = async (id) => {
    if (!confirm('¿Desactivar este producto? Quedará oculto pero se conservará el historial de ventas.')) return
    try { await api.delete(`/products/${id}`); toast.success('Producto desactivado'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Error') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#111111]">Productos</h1>
        <button onClick={openCreate} className="btn-primary">+ Nuevo producto</button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input className="input-field max-w-xs text-sm" placeholder="Buscar producto..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }} />
        <select className="input-field max-w-xs text-sm" value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1) }}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mimi-50">
              {['Nombre','Categoría','Unidad','Precio','Stock','Estado',''].map((h,i) => (
                <th key={i} className={`py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444] ${i >= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-3 px-4 font-medium">{p.nombre}</td>
                <td className="py-3 px-4">
                  {p.categoria_nombre && <span className="text-xs bg-mimi-50 text-mimi-500 px-2 py-1 rounded-full">{p.categoria_nombre}</span>}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.unidad_medida === 'kg' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                    {p.unidad_medida === 'kg' ? 'Por kilo' : 'Unidad'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-semibold">
                  {fmt(p.precio)}{p.unidad_medida === 'kg' ? <span className="text-xs text-[#444444] font-normal ml-1">/kg</span> : ''}
                </td>
                <td className="py-3 px-4 text-right">{p.unidad_medida === 'kg' ? '—' : p.stock}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right space-x-3">
                  <button onClick={() => openEdit(p)} className="text-mimi-500 hover:underline text-xs font-medium">Editar</button>
                  <button onClick={() => remove(p.id)} className="text-red-500 hover:underline text-xs font-medium">Desactivar</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-[#444444]">No se encontraron productos</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4 text-sm text-[#444444]">
        <span>{total} productos en total</span>
        <div className="flex gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="btn-secondary py-1 px-3 text-xs">Anterior</button>
          <button disabled={page * 20 >= total} onClick={() => setPage(p => p+1)} className="btn-secondary py-1 px-3 text-xs">Siguiente</button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar producto' : 'Nuevo producto'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">Nombre *</label><input className="input-field" value={form.nombre} onChange={e => set('nombre', e.target.value)} required /></div>
              <div><label className="block text-sm font-medium mb-1">Descripción</label><textarea className="input-field" rows={2} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} /></div>
              <div>
                <label className="block text-sm font-medium mb-1">Unidad de medida *</label>
                <select className="input-field" value={form.unidad_medida} onChange={e => set('unidad_medida', e.target.value)}>
                  <option value="unidad">Unidad (se vende por unidad)</option>
                  <option value="kg">Por kilo (se vende por peso)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {form.unidad_medida === 'kg' ? 'Precio por kilo *' : 'Precio *'}
                  </label>
                  <input type="number" step="0.01" min="0" className="input-field" value={form.precio} onChange={e => set('precio', e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {form.unidad_medida === 'kg' ? 'Stock (kg)' : 'Stock'}
                  </label>
                  <input type="number" min="0" className="input-field" value={form.stock} onChange={e => set('stock', e.target.value)} disabled={form.unidad_medida === 'kg'} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Categoría</label>
                <select className="input-field" value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
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
