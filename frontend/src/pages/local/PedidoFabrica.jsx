import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (v) => `$${parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

const ESTADO_BADGE = {
  nuevo: 'bg-yellow-100 text-yellow-700',
  completado: 'bg-green-100 text-green-700',
}

export default function PedidoFabrica() {
  const [tab, setTab] = useState('nuevo') // 'nuevo' | 'historial'
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [cart, setCart] = useState([])
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)

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
    if (tab === 'historial') loadOrders()
  }, [tab])

  async function loadOrders() {
    setLoadingOrders(true)
    try {
      const res = await api.get('/factory-orders')
      setOrders(res.data)
    } catch { toast.error('Error al cargar pedidos') }
    finally { setLoadingOrders(false) }
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
      await api.post('/factory-orders', {
        items: cart.map(i => ({ product_id: i.product_id, cantidad: i.cantidad })),
        notas: notas || null,
      })
      toast.success('Pedido enviado a fábrica')
      setCart([])
      setNotas('')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar pedido')
    } finally {
      setLoading(false)
    }
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const fechaEntrega = tomorrow.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Header con tabs */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#111111]">Pedido a Fábrica</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('nuevo')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === 'nuevo' ? 'bg-mimi-500 text-white' : 'bg-white border border-[#E5E7EB] text-[#444444] hover:bg-gray-50'}`}
          >
            Nuevo pedido
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === 'historial' ? 'bg-mimi-500 text-white' : 'bg-white border border-[#E5E7EB] text-[#444444] hover:bg-gray-50'}`}
          >
            Mis pedidos
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

          {/* Panel pedido */}
          <div className="w-72 flex-shrink-0 flex flex-col">
            <div className="card flex flex-col h-full overflow-hidden p-0">
              <div className="px-4 py-3 border-b border-[#E5E7EB]">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#111111]">Pedido</h2>
                  {cart.length > 0 && (
                    <button onClick={() => setCart([])} className="text-xs text-[#444444] hover:text-red-500">Vaciar</button>
                  )}
                </div>
                <p className="text-xs text-mimi-500 mt-0.5">Entrega: {fechaEntrega}</p>
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

              <div className="px-3 pb-3 border-t border-[#E5E7EB] pt-3">
                <textarea
                  className="input-field text-xs py-1.5 resize-none"
                  rows={2}
                  placeholder="Notas para fábrica (opcional)"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                />
              </div>

              <div className="px-3 pb-4">
                <button onClick={handleConfirm} disabled={loading || cart.length === 0} className="btn-primary w-full py-3 text-base">
                  {loading ? 'Enviando...' : '📦 Enviar pedido'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <div className="flex-1 overflow-auto">
          {loadingOrders ? (
            <p className="text-center text-[#444444] py-12">Cargando...</p>
          ) : orders.length === 0 ? (
            <p className="text-center text-[#444444] py-12">No tenés pedidos aún</p>
          ) : (
            <div className="space-y-3">
              {orders.map(o => (
                <div key={o.id} className="card p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-[#111111]">Pedido #{o.id}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${ESTADO_BADGE[o.estado]}`}>
                      {o.estado}
                    </span>
                  </div>
                  <p className="text-xs text-[#444444]">
                    Entrega: {new Date(o.fecha_entrega).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  {o.notas && <p className="text-xs text-[#444444] mt-1">Nota: {o.notas}</p>}
                  <p className="text-xs text-[#444444] mt-1">Creado: {new Date(o.created_at).toLocaleString('es-AR')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
