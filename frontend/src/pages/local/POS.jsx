import { useState, useEffect, useRef } from 'react'
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

const STORAGE_KEY = 'pos_carts'

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `c${Date.now()}${Math.floor(Math.random() * 1e6)}`

const makeCart = (nombre) => ({ id: newId(), nombre, items: [], metodoPago: 'efectivo' })

// Devuelve el primer nombre "Cliente N" libre, rellenando huecos
const nextClienteName = (existing) => {
  const names = new Set(existing.map(c => c.nombre))
  let n = 1
  while (names.has(`Cliente ${n}`)) n++
  return `Cliente ${n}`
}

const loadInitial = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && Array.isArray(saved.carts) && saved.carts.length) {
      const carts = saved.carts.map(c => ({
        id: c.id || newId(),
        nombre: c.nombre || 'Cliente',
        items: Array.isArray(c.items) ? c.items : [],
        metodoPago: c.metodoPago || 'efectivo',
      }))
      const activeCartId = carts.find(c => c.id === saved.activeCartId)?.id || carts[0].id
      return { carts, activeCartId }
    }
  } catch { /* noop */ }
  const first = makeCart('Cliente 1')
  return { carts: [first], activeCartId: first.id }
}

export default function POS() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')

  // ── Múltiples carritos ──────────────────────────────────────────────
  const initialRef = useRef(null)
  if (!initialRef.current) initialRef.current = loadInitial()
  const [carts, setCarts] = useState(initialRef.current.carts)
  const [activeCartId, setActiveCartId] = useState(initialRef.current.activeCartId)
  const [editingCartId, setEditingCartId] = useState(null)
  const [editingName, setEditingName] = useState('')

  const [loading, setLoading] = useState(false)
  const [ticket, setTicket] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [clienteForm, setClienteForm] = useState({ nombre: '', email: '', whatsapp: '' })
  const [weightPopup, setWeightPopup] = useState(null)
  const [gramosInput, setGramosInput] = useState('')

  // Carrito activo (siempre existe al menos uno)
  const activeCart = carts.find(c => c.id === activeCartId) || carts[0]
  const cart = activeCart.items
  const metodoPago = activeCart.metodoPago

  useEffect(() => {
    async function load() {
      try {
        const [pr, cr] = await Promise.all([
          api.get('/products?activo=true&limit=1000'),
          api.get('/categories'),
        ])
        setProducts(pr.data.data)
        setCategories(cr.data)
      } catch { toast.error('Error al cargar productos') }
    }
    load()
  }, [])

  // Persistir carritos en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ carts, activeCartId: activeCart.id }))
    } catch { /* noop */ }
  }, [carts, activeCartId, activeCart.id])

  // Asegurar que el carrito activo siempre apunte a uno existente
  useEffect(() => {
    if (!carts.some(c => c.id === activeCartId)) setActiveCartId(carts[0].id)
  }, [carts, activeCartId])

  const filtered = products.filter(p => {
    const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || String(p.categoria_id) === String(catFilter)
    return matchSearch && matchCat
  })

  // ── Operaciones sobre el carrito activo ─────────────────────────────
  const updateActiveItems = (updater) => {
    setCarts(prev => prev.map(c =>
      c.id === activeCart.id
        ? { ...c, items: typeof updater === 'function' ? updater(c.items) : updater }
        : c
    ))
  }

  const setMetodoPago = (value) => {
    setCarts(prev => prev.map(c => c.id === activeCart.id ? { ...c, metodoPago: value } : c))
  }

  // ── Gestión de carritos (pestañas) ──────────────────────────────────
  const addCart = () => {
    const c = makeCart(nextClienteName(carts))
    setCarts(prev => [...prev, c])
    setActiveCartId(c.id)
  }

  const removeCart = (id) => {
    const c = carts.find(x => x.id === id)
    if (c && c.items.length > 0 && !window.confirm(`¿Cerrar "${c.nombre}"? Se perderán sus productos.`)) return
    // Si cerramos el carrito activo, cambiamos antes a otro para evitar parpadeos
    if (id === activeCart.id) {
      const remaining = carts.filter(x => x.id !== id)
      if (remaining.length) setActiveCartId(remaining[0].id)
    }
    // Eliminación con updater funcional: robusta ante carritos agregados durante una venta en curso
    setCarts(prev => {
      const remaining = prev.filter(x => x.id !== id)
      return remaining.length ? remaining : [makeCart('Cliente 1')]
    })
  }

  const renameCart = (id, nombre) => setCarts(prev => prev.map(c => c.id === id ? { ...c, nombre } : c))

  const startRename = (c) => { setEditingCartId(c.id); setEditingName(c.nombre) }
  const commitRename = () => {
    if (editingCartId) {
      const name = editingName.trim()
      if (name) renameCart(editingCartId, name)
    }
    setEditingCartId(null)
    setEditingName('')
  }
  const cancelRename = () => { setEditingCartId(null); setEditingName('') }

  // ── Items ───────────────────────────────────────────────────────────
  const addToCart = (product) => {
    if (product.unidad_medida === 'kg') {
      setGramosInput('')
      setWeightPopup(product)
      return
    }
    const existing = cart.find(i => i.product_id === product.id)
    if (existing && existing.cantidad >= product.stock) {
      toast.error(`Stock máximo disponible: ${product.stock}`)
      return
    }
    updateActiveItems(prev => {
      const ex = prev.find(i => i.product_id === product.id)
      if (ex) return prev.map(i => i.product_id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { product_id: product.id, nombre: product.nombre, precio_unitario: parseFloat(product.precio), cantidad: 1, es_peso: false }]
    })
  }

  const addWeightToCart = () => {
    const gramos = parseInt(gramosInput)
    if (!gramos || gramos <= 0) { toast.error('Ingresá una cantidad válida de gramos'); return }
    const p = weightPopup
    const precioTotal = parseFloat(p.precio) * gramos / 1000
    updateActiveItems(prev => {
      const ex = prev.find(i => i.product_id === p.id && i.es_peso)
      if (ex) {
        return prev.map(i =>
          i.product_id === p.id && i.es_peso
            ? { ...i, gramos, precio_unitario: parseFloat(p.precio), subtotal: precioTotal }
            : i
        )
      }
      return [...prev, {
        product_id: p.id,
        nombre: p.nombre,
        precio_unitario: parseFloat(p.precio),
        cantidad: gramos,
        es_peso: true,
        gramos,
        subtotal: precioTotal,
      }]
    })
    setWeightPopup(null)
    setGramosInput('')
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
    updateActiveItems(prev => prev
      .map(i => i.product_id === product_id ? { ...i, cantidad: i.cantidad + delta } : i)
      .filter(i => i.cantidad > 0)
    )
  }

  const removeItem = (product_id) => updateActiveItems(prev => prev.filter(i => i.product_id !== product_id))
  const clearActiveCart = () => setCarts(prev => prev.map(c => c.id === activeCart.id ? { ...c, items: [], metodoPago: 'efectivo' } : c))

  const itemTotal = (i) => i.es_peso ? i.subtotal : i.precio_unitario * i.cantidad
  const total = cart.reduce((s, i) => s + itemTotal(i), 0)
  const cartCount = (c) => c.items.reduce((s, i) => s + (i.es_peso ? 1 : i.cantidad), 0)

  const openModal = () => {
    if (cart.length === 0) return toast.error('Agregá al menos un producto')
    setClienteForm({ nombre: '', email: '', whatsapp: '' })
    setShowModal(true)
  }

  const submitSale = async (cliente) => {
    const saleCart = activeCart
    setShowModal(false)
    setLoading(true)
    try {
      const res = await api.post('/sales', {
        cliente_nombre: cliente.nombre,
        cliente_email: cliente.email || null,
        cliente_whatsapp: cliente.whatsapp || null,
        metodo_pago: saleCart.metodoPago,
        items: saleCart.items.map(i => ({ product_id: i.product_id, cantidad: i.es_peso ? i.gramos : i.cantidad })),
      })
      setTicket(res.data)
      removeCart(saleCart.id)
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
                <p className="text-mimi-500 font-bold text-base mt-1">
                  {fmt(p.precio)}{p.unidad_medida === 'kg' && <span className="text-xs font-normal text-[#444444] ml-1">/kg</span>}
                </p>
                {p.unidad_medida === 'kg'
                  ? <p className="text-xs text-orange-500 mt-1 font-medium">Por peso</p>
                  : <p className="text-xs text-[#444444] mt-1">Stock: {p.stock}</p>
                }
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-4 text-center text-[#444444] py-12">No se encontraron productos</p>
            )}
          </div>
        </div>
      </div>

      {/* Panel carrito */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2 min-h-0">
        {/* Pestañas de carritos */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-shrink-0">
          {carts.map(c => {
            const isActive = c.id === activeCart.id
            const count = cartCount(c)
            return (
              <div
                key={c.id}
                className={`group flex items-center gap-1 pl-2.5 pr-1 py-1.5 rounded-xl flex-shrink-0 border transition-colors ${
                  isActive ? 'bg-mimi-500 border-mimi-500 text-white' : 'bg-white border-[#E5E7EB] text-[#444444] hover:border-mimi-300'
                }`}
              >
                {editingCartId === c.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') cancelRename() }}
                    className="w-20 text-xs text-[#111111] rounded px-1 py-0.5 border border-mimi-300 outline-none"
                  />
                ) : (
                  <span
                    onClick={() => setActiveCartId(c.id)}
                    onDoubleClick={() => startRename(c)}
                    title="Doble click para renombrar"
                    className="text-xs font-semibold whitespace-nowrap max-w-[90px] truncate cursor-pointer"
                  >
                    {c.nombre}
                    {count > 0 && <span className={isActive ? 'text-white/80 ml-1' : 'text-mimi-500 ml-1'}>·{count}</span>}
                  </span>
                )}
                {carts.length > 1 && (
                  <button
                    onClick={() => removeCart(c.id)}
                    title="Cerrar carrito"
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                      isActive ? 'hover:bg-white/25' : 'hover:bg-gray-100'
                    }`}
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
          <button
            onClick={addCart}
            title="Nuevo carrito"
            className="flex-shrink-0 w-8 h-8 rounded-xl border border-dashed border-mimi-300 text-mimi-500 font-bold hover:bg-mimi-50 flex items-center justify-center"
          >
            +
          </button>
        </div>

        <div className="card flex flex-col flex-1 min-h-0 overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#111111] truncate">{activeCart.nombre}</h2>
              {cart.length > 0 && (
                <button onClick={clearActiveCart} className="text-xs text-[#444444] hover:text-red-500 flex-shrink-0">Vaciar</button>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
            {cart.length === 0 && (
              <p className="text-sm text-[#444444] text-center py-8">El carrito está vacío</p>
            )}
            {cart.map(item => (
              <div key={`${item.product_id}-${item.es_peso ? item.gramos : 'u'}`} className="flex items-center gap-2 border border-[#E5E7EB] rounded-xl p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#111111] truncate leading-tight">{item.nombre}</p>
                  {item.es_peso
                    ? <p className="text-xs text-orange-500 font-medium mt-0.5">{item.gramos}g · {fmt(item.precio_unitario)}/kg</p>
                    : <p className="text-xs text-mimi-500 font-medium mt-0.5">{fmt(item.precio_unitario)}</p>
                  }
                </div>
                {item.es_peso ? (
                  <button
                    onClick={() => { setGramosInput(String(item.gramos)); setWeightPopup(products.find(p => p.id === item.product_id)) }}
                    className="text-xs text-orange-500 hover:underline flex-shrink-0"
                  >
                    ✎
                  </button>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => updateQty(item.product_id, -1)} className="w-5 h-5 rounded-lg bg-mimi-50 text-mimi-500 font-bold text-xs flex items-center justify-center hover:bg-mimi-100">−</button>
                    <span className="w-5 text-center text-xs font-bold">{item.cantidad}</span>
                    <button onClick={() => updateQty(item.product_id, 1)} className="w-5 h-5 rounded-lg bg-mimi-50 text-mimi-500 font-bold text-xs flex items-center justify-center hover:bg-mimi-100">+</button>
                  </div>
                )}
                <button onClick={() => removeItem(item.product_id)} className="text-red-400 hover:text-red-600 text-xs ml-0.5">✕</button>
              </div>
            ))}
          </div>

          {/* Subtotales */}
          {cart.length > 0 && (
            <div className="px-3 pb-2 border-t border-[#E5E7EB] pt-2 space-y-0.5">
              {cart.map(item => (
                <div key={`sub-${item.product_id}-${item.es_peso ? item.gramos : 'u'}`} className="flex justify-between text-xs text-[#444444]">
                  <span className="truncate max-w-[130px]">
                    {item.nombre} {item.es_peso ? `${item.gramos}g` : `×${item.cantidad}`}
                  </span>
                  <span className="font-medium">{fmt(itemTotal(item))}</span>
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

      {/* Popup gramos */}
      {weightPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-[#111111] mb-0.5">{weightPopup.nombre}</h2>
            <p className="text-sm text-[#444444] mb-5">Precio: {fmt(weightPopup.precio)} por kilo</p>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-[#111111] mb-1">Gramos</label>
              <input
                className="input-field text-2xl font-bold text-center"
                type="number"
                min="1"
                step="1"
                autoFocus
                placeholder="350"
                value={gramosInput}
                onChange={e => setGramosInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addWeightToCart()}
              />
            </div>
            {gramosInput > 0 && (
              <div className="bg-mimi-50 rounded-xl p-3 mb-4 text-center">
                <p className="text-xs text-[#444444] mb-0.5">Precio a cobrar</p>
                <p className="text-2xl font-bold text-mimi-500">
                  {fmt(parseFloat(weightPopup.precio) * parseInt(gramosInput) / 1000)}
                </p>
                <p className="text-xs text-[#444444] mt-0.5">{gramosInput}g</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={addWeightToCart}
                disabled={!gramosInput || parseInt(gramosInput) <= 0}
                className="btn-primary flex-1 py-3"
              >
                Agregar al carrito
              </button>
              <button
                onClick={() => { setWeightPopup(null); setGramosInput('') }}
                className="btn-secondary flex-1 py-3"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {ticket && <Ticket sale={ticket} onClose={() => setTicket(null)} />}
    </div>
  )
}
