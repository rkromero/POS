import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import Ticket from '../../components/Ticket'

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'debito', label: 'Tarjeta de débito' },
  { value: 'credito', label: 'Tarjeta de crédito' },
  { value: 'transferencia', label: 'Transferencia' },
]

const fmt = (v) => `$${parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

export default function POS() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [cart, setCart] = useState([])
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [loading, setLoading] = useState(false)
  const [ticket, setTicket] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [clienteForm, setClienteForm] = useState({ nombre: '', email: '', whatsapp: '' })

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

  const filtered = products.filter(p => {
    const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || String(p.categoria_id) === String(catFilter)
    return matchSearch && matchCat
  })

  const addToCart = (product) => {
    const existing = cart.find(i => i.product_id === product.id)
    if (existing && existing.cantidad >= product.stock) {
      toast.error(`Stock máximo disponible: ${product.stock}`)
      return
    }
    setCart(prev => {
      const ex = prev.find(i => i.product_id === product.id)
      if (ex) return prev.map(i => i.product_id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { product_id: product.id, nombre: product.nombre, precio_unitario: parseFloat(product.precio), cantidad: 1 }]
    })
  }

  const updateQty = (product_id, delta) => {
    if (delta > 0) {
      const product = products.find(p => p.id === product_id)
      const item = cart.find(i => i.product_id === product_id)
      if (product && item && item.cantidad >= product.stock) {
        toast.error(`Stock máximo disponible: ${product.stock}`)
        return
      }
    }
    setCart(prev => prev
      .map(i => i.product_id === product_id ? { ...i, cantidad: i.cantidad + delta } : i)
      .filter(i => i.cantidad > 0)
    )
  }

  const removeItem = (product_id) => setCart(prev => prev.filter(i => i.product_id !== product_id))
  const clearCart = () => { setCart([]); setMetodoPago('efectivo') }

  const total = cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0)

  const openModal = () => {
    if (cart.length === 0) return toast.error('Agregá al menos un producto')
    setClienteForm({ nombre: '', email: '', whatsapp: '' })
    setShowModal(true)
  }

  const submitSale = async (cliente) => {
    setShowModal(false)
    setLoading(true)
    try {
      const res = await api.post('/sales', {
        cliente_nombre: cliente.nombre,
        cliente_email: cliente.email || null,
        cliente_whatsapp: cliente.whatsapp || null,
        metodo_pago: metodoPago,
        items: cart.map(i => ({ product_id: i.product_id, cantidad: i.cantidad })),
      })
      setTicket(res.data)
      clearCart()
      toast.success('¡Venta registrada!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrar venta')
    } finally {
      setLoading(false)
    }
  }

  const handleGuardar = () => {
    if (!clienteForm.nombre.trim()) return toast.error('El nombre del cliente es requerido')
    submitSale({ nombre: clienteForm.nombre.trim(), email: clienteForm.email, whatsapp: clienteForm.whatsapp })
  }

  const handleInvitado = () => {
    submitSale({ nombre: 'Invitado', email: null, whatsapp: null })
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-3rem)]">
      {/* Panel productos */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-[#111111]">Caja</h1>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            className="input-field flex-1 text-sm"
            placeholder="Buscar producto por nombre..."
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
                disabled={p.stock === 0}
                className="card text-left hover:border-mimi-500 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed p-4 active:scale-95"
              >
                {p.categoria_nombre && (
                  <span className="inline-block text-xs bg-mimi-50 text-mimi-500 px-2 py-0.5 rounded-full font-medium mb-2">
                    {p.categoria_nombre}
                  </span>
                )}
                <p className="font-semibold text-[#111111] text-sm leading-snug">{p.nombre}</p>
                <p className="text-mimi-500 font-bold text-base mt-1">{fmt(p.precio)}</p>
                <p className="text-xs text-[#444444] mt-1">Stock: {p.stock}</p>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-4 text-center text-[#444444] py-12">No se encontraron productos</p>
            )}
          </div>
        </div>
      </div>

      {/* Panel carrito */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-0">
        <div className="card flex flex-col h-full overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#111111]">Carrito</h2>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-xs text-[#444444] hover:text-red-500">Vaciar</button>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
            {cart.length === 0 && (
              <p className="text-sm text-[#444444] text-center py-8">El carrito está vacío</p>
            )}
            {cart.map(item => (
              <div key={item.product_id} className="flex items-center gap-2 border border-[#E5E7EB] rounded-xl p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#111111] truncate leading-tight">{item.nombre}</p>
                  <p className="text-xs text-mimi-500 font-medium mt-0.5">{fmt(item.precio_unitario)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => updateQty(item.product_id, -1)} className="w-5 h-5 rounded-lg bg-mimi-50 text-mimi-500 font-bold text-xs flex items-center justify-center hover:bg-mimi-100">−</button>
                  <span className="w-5 text-center text-xs font-bold">{item.cantidad}</span>
                  <button onClick={() => updateQty(item.product_id, 1)} className="w-5 h-5 rounded-lg bg-mimi-50 text-mimi-500 font-bold text-xs flex items-center justify-center hover:bg-mimi-100">+</button>
                </div>
                <button onClick={() => removeItem(item.product_id)} className="text-red-400 hover:text-red-600 text-xs ml-0.5">✕</button>
              </div>
            ))}
          </div>

          {/* Subtotales */}
          {cart.length > 0 && (
            <div className="px-3 pb-2 border-t border-[#E5E7EB] pt-2 space-y-0.5">
              {cart.map(item => (
                <div key={item.product_id} className="flex justify-between text-xs text-[#444444]">
                  <span className="truncate max-w-[130px]">{item.nombre} ×{item.cantidad}</span>
                  <span className="font-medium">{fmt(item.precio_unitario * item.cantidad)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm text-[#111111] pt-1 border-t border-[#E5E7EB] mt-1">
                <span>Total</span>
                <span className="text-mimi-500 text-base">{fmt(total)}</span>
              </div>
            </div>
          )}

          {/* Pago */}
          <div className="px-3 pb-3 border-t border-[#E5E7EB] pt-3">
            <p className="text-xs font-semibold text-[#444444] uppercase tracking-wide mb-1.5">Método de pago</p>
            <select className="input-field text-xs py-1.5" value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="px-3 pb-4">
            <button onClick={openModal} disabled={loading || cart.length === 0} className="btn-primary w-full py-3 text-base">
              {loading ? 'Registrando...' : '✓ Confirmar venta'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal datos del cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-[#111111] mb-1">Datos del cliente</h2>
            <p className="text-sm text-[#444444] mb-4">Ingresá los datos o continuá como invitado.</p>
            <div className="space-y-3">
              <input
                className="input-field text-sm"
                placeholder="Nombre *"
                value={clienteForm.nombre}
                onChange={e => setClienteForm(f => ({ ...f, nombre: e.target.value }))}
                autoFocus
              />
              <input
                className="input-field text-sm"
                placeholder="Email (opcional)"
                type="email"
                value={clienteForm.email}
                onChange={e => setClienteForm(f => ({ ...f, email: e.target.value }))}
              />
              <input
                className="input-field text-sm"
                placeholder="WhatsApp (opcional)"
                value={clienteForm.whatsapp}
                onChange={e => setClienteForm(f => ({ ...f, whatsapp: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleInvitado} className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#444444] hover:bg-gray-50">
                Invitado
              </button>
              <button onClick={handleGuardar} className="flex-1 py-2.5 rounded-xl bg-mimi-500 text-white text-sm font-semibold hover:bg-mimi-600">
                Guardar
              </button>
            </div>
            <button onClick={() => setShowModal(false)} className="w-full mt-3 text-xs text-[#444444] hover:text-[#111111]">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {ticket && <Ticket sale={ticket} onClose={() => setTicket(null)} />}
    </div>
  )
}
