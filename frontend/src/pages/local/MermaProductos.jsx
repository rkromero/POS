import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const MOTIVOS = ['Desperfecto', 'Vencimiento', 'Otro']

const MOTIVO_BADGE = {
  Desperfecto: 'bg-orange-100 text-orange-700',
  Vencimiento: 'bg-red-100 text-red-700',
  Otro: 'bg-gray-100 text-gray-600',
}

export default function MermaProductos() {
  const [tab, setTab] = useState('nuevo')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [cart, setCart] = useState([])
  const [motivo, setMotivo] = useState('Desperfecto')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [historial, setHistorial] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [pr, cr] = await Promise.all([
          api.get('/products?activo=true&limit=200'),
          api.get('/categories'),
        ])
        setProducts(pr.data.data)
        setCategories(cr.data)
      } catch { toast.error('Error al cargar productos') }
    }
    load()
  }, [])

  useEffect(() => {
    if (tab === 'historial') loadHistorial()
  }, [tab])

  async function loadHistorial() {
    setLoadingHistorial(true)
    try {
      const res = await api.get('/mermas')
      setHistorial(res.data)
    } catch { toast.error('Error al cargar historial') }
    finally { setLoadingHistorial(false) }
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || String(p.categoria_id) === String(catFilter)
    return matchSearch && matchCat
  })

  const addToCart = (product) => {
    setCart(prev => {
      const ex = prev.find(i => i.product_id === product.id)
      if (ex) return prev.map(i => i.product_id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { product_id: product.id, nombre: product.nombre, cantidad: 1 }]
    })
  }

  const updateQty = (product_id, delta) => {
    setCart(prev => prev
      .map(i => i.product_id === product_id ? { ...i, cantidad: i.cantidad + delta } : i)
      .filter(i => i.cantidad > 0)
    )
  }

  const handleConfirm = async () => {
    if (cart.length === 0) return toast.error('Agregá al menos un producto')
    setLoading(true)
    try {
      await api.post('/mermas', {
        items: cart.map(i => ({ product_id: i.product_id, cantidad: i.cantidad })),
        motivo,
        notas: notas || null,
      })
      toast.success('Merma registrada')
      setCart([])
      setNotas('')
      setMotivo('Desperfecto')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  const fechaHoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#111111]">Merma de Productos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('nuevo')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === 'nuevo' ? 'bg-mimi-500 text-white' : 'bg-white border border-[#E5E7EB] text-[#444444] hover:bg-gray-50'}`}
          >
            Registrar
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === 'historial' ? 'bg-mimi-500 text-white' : 'bg-white border border-[#E5E7EB] text-[#444444] hover:bg-gray-50'}`}
          >
            Historial
          </button>
        </div>
      </div>

      {tab === 'nuevo' && (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Panel productos */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex gap-2 mb-4">
              <input
                className="input-field flex-1 text-sm"
                placeholder="Buscar producto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select className="input-field w-44 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="card text-left hover:border-mimi-500 hover:shadow-md transition-all p-4 active:scale-95"
                  >
                    {p.categoria_nombre && (
                      <span className="inline-block text-xs bg-mimi-50 text-mimi-500 px-2 py-0.5 rounded-full font-medium mb-2">
                        {p.categoria_nombre}
                      </span>
                    )}
                    <p className="font-semibold text-[#111111] text-sm leading-snug">{p.nombre}</p>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="col-span-4 text-center text-[#444444] py-12">No se encontraron productos</p>
                )}
              </div>
            </div>
          </div>

          {/* Panel merma */}
          <div className="w-72 flex-shrink-0 flex flex-col">
            <div className="card flex flex-col h-full overflow-hidden p-0">
              <div className="px-4 py-3 border-b border-[#E5E7EB]">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#111111]">Productos tirados</h2>
                  {cart.length > 0 && (
                    <button onClick={() => setCart([])} className="text-xs text-[#444444] hover:text-red-500">Vaciar</button>
                  )}
                </div>
                <p className="text-xs text-[#444444] mt-0.5 capitalize">{fechaHoy}</p>
              </div>

              <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
                {cart.length === 0 && (
                  <p className="text-sm text-[#444444] text-center py-8">Seleccioná productos</p>
                )}
                {cart.map(item => (
                  <div key={item.product_id} className="flex items-center gap-2 border border-[#E5E7EB] rounded-xl p-2.5">
                    <p className="flex-1 text-xs font-semibold text-[#111111] truncate">{item.nombre}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => updateQty(item.product_id, -1)} className="w-5 h-5 rounded-lg bg-mimi-50 text-mimi-500 font-bold text-xs flex items-center justify-center hover:bg-mimi-100">−</button>
                      <span className="w-6 text-center text-xs font-bold">{item.cantidad}</span>
                      <button onClick={() => updateQty(item.product_id, 1)} className="w-5 h-5 rounded-lg bg-mimi-50 text-mimi-500 font-bold text-xs flex items-center justify-center hover:bg-mimi-100">+</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-3 pt-3 border-t border-[#E5E7EB] space-y-2">
                <div>
                  <label className="text-xs font-medium text-[#444444] mb-1 block">Motivo *</label>
                  <select
                    className="input-field text-sm"
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                  >
                    {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <textarea
                  className="input-field text-xs py-1.5 resize-none"
                  rows={2}
                  placeholder="Notas (opcional)"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                />
              </div>

              <div className="px-3 pb-4 pt-2">
                <button
                  onClick={handleConfirm}
                  disabled={loading || cart.length === 0}
                  className="btn-primary w-full py-3 text-base"
                >
                  {loading ? 'Registrando...' : '🗑️ Registrar merma'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <div className="flex-1 overflow-auto">
          {loadingHistorial ? (
            <p className="text-center text-[#444444] py-12">Cargando...</p>
          ) : historial.length === 0 ? (
            <p className="text-center text-[#444444] py-12">No hay registros de merma aún</p>
          ) : (
            <div className="space-y-3">
              {historial.map(m => (
                <div key={m.id} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${MOTIVO_BADGE[m.motivo] || 'bg-gray-100 text-gray-600'}`}>
                        {m.motivo}
                      </span>
                      <span className="text-sm font-bold text-[#111111]">Merma #{m.id}</span>
                    </div>
                    <span className="text-xs text-[#444444]">
                      {new Date(String(m.created_at).replace(' ', 'T')).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {m.items.map(i => (
                      <div key={i.id} className="flex items-center justify-between text-sm">
                        <span className="text-[#111111]">{i.producto_nombre}</span>
                        <span className="font-semibold text-[#444444]">×{i.cantidad}</span>
                      </div>
                    ))}
                  </div>
                  {m.notas && <p className="text-xs text-[#444444] mt-2 bg-gray-50 rounded-lg px-2 py-1">{m.notas}</p>}
                  <p className="text-xs text-[#AAAAAA] mt-2">{m.user_nombre}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
