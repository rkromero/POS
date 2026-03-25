import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (v) => `$${parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

export default function LocalProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ precio: '', stock: '' })
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
    } catch { toast.error('Error al cargar') }
  }

  useEffect(() => { load() }, [page, search, catFilter])

  const startEdit = (p) => { setEditing(p.id); setEditForm({ precio: p.precio, stock: p.stock }) }
  const cancelEdit = () => setEditing(null)

  const saveEdit = async (id) => {
    try {
      await api.put(`/products/${id}`, { precio: parseFloat(editForm.precio), stock: parseInt(editForm.stock) })
      toast.success('Producto actualizado')
      setEditing(null)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-[#111111]">Productos</h1>
      <p className="text-sm text-[#444444] -mt-4 mb-4">Podés editar el precio y stock de cada producto.</p>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input className="input-field max-w-xs text-sm" placeholder="Buscar..." value={search}
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
              <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Nombre</th>
              <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Categoría</th>
              <th className="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Precio</th>
              <th className="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Stock</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-3 px-4 font-medium">{p.nombre}</td>
                <td className="py-3 px-4">
                  {p.categoria_nombre && <span className="text-xs bg-mimi-50 text-mimi-500 px-2 py-1 rounded-full">{p.categoria_nombre}</span>}
                </td>
                {editing === p.id ? (
                  <>
                    <td className="py-2 px-4 text-right">
                      <input type="number" step="0.01" min="0" className="input-field w-28 text-right text-sm py-1.5"
                        value={editForm.precio} onChange={e => setEditForm(f => ({...f, precio: e.target.value}))} />
                    </td>
                    <td className="py-2 px-4 text-right">
                      <input type="number" min="0" className="input-field w-20 text-right text-sm py-1.5"
                        value={editForm.stock} onChange={e => setEditForm(f => ({...f, stock: e.target.value}))} />
                    </td>
                    <td className="py-2 px-4 text-right space-x-3">
                      <button onClick={() => saveEdit(p.id)} className="text-green-600 hover:underline text-xs font-semibold">Guardar</button>
                      <button onClick={cancelEdit} className="text-[#444444] hover:underline text-xs">Cancelar</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-3 px-4 text-right font-semibold">{fmt(p.precio)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={p.stock <= 5 ? 'text-red-600 font-semibold' : ''}>{p.stock}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => startEdit(p)} className="text-mimi-500 hover:underline text-xs font-medium">Editar</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-[#444444]">No se encontraron productos</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4 text-sm text-[#444444]">
        <span>{total} productos</span>
        <div className="flex gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="btn-secondary py-1 px-3 text-xs">Anterior</button>
          <button disabled={page * 20 >= total} onClick={() => setPage(p => p+1)} className="btn-secondary py-1 px-3 text-xs">Siguiente</button>
        </div>
      </div>
    </div>
  )
}
