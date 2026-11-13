import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import Ticket from '../../components/Ticket'
import { useAuth } from '../../context/AuthContext'

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
  const [matchedClient, setMatchedClient] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [weightPopup, setWeightPopup] = useState(null)
  const [gramosInput, setGramosInput] = useState('')
  // Si el local tiene cajero, el POS no cobra: envía el pedido a caja
  const [tieneCajero, setTieneCajero] = useState(false)
  const { user } = useAuth()
  // El cajero usa el mismo POS pero cobra directo (venta a su nombre, entra en su cierre de caja)
  const esCajero = user?.role === 'cajero'
  const enviaACaja = tieneCajero && !esCajero

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
    loadCajeroConfig()
  }, [])

  async function loadCajeroConfig() {
    try {
      const res = await api.get('/pedidos-caja/config')
      setTieneCajero(!!res.data.tiene_cajero)
    } catch { /* si falla, el POS sigue cobrando como siempre */ }
  }

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

  // Buscar cliente por teléfono mientras se carga el pedido (debounce)
  useEffect(() => {
    if (!showModal) return
    const phone = clienteForm.whatsapp.trim()
    if (phone.length < 5) { setMatchedClient(null); setLookupLoading(false); return }
    let cancelled = false
    setLookupLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/loyalty/search', { params: { q: phone } })
        if (cancelled) return
        const c = res.data
        // Sólo es un match si coincide el teléfono (no por nombre via fallback del backend)
        const isPhoneMatch = c && c.whatsapp && String(c.whatsapp).trim() === phone
        setMatchedClient(isPhoneMatch ? c : null)
      } catch {
        if (!cancelled) setMatchedClient(null)
      } finally {
        if (!cancelled) setLookupLoading(false)
      }
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [clienteForm.whatsapp, showModal])

  // El nombre sólo es obligatorio si el teléfono no existe en la base o el cliente no tiene nombre
  const clienteNombreRegistrado = matchedClient?.nombre?.trim() || ''
  const nombreObligatorio = !clienteNombreRegistrado

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
    closeCart(id)
  }

  // Cierra el carrito sin pedir confirmación
  const closeCart = (id) => {
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
    setMatchedClient(null)
    setLookupLoading(false)
    setShowModal(true)
  }

  const submitPedido = async (cliente) => {
    const pedidoCart = activeCart
    setShowModal(false)
    setLoading(true)
    try {
      await api.post('/pedidos-caja', {
        nombre_carrito: pedidoCart.nombre,
        cliente_nombre: cliente.nombre,
        cliente_email: cliente.email || null,
        cliente_whatsapp: cliente.whatsapp || null,
        items: pedidoCart.items.map(i => ({ product_id: i.product_id, cantidad: i.es_peso ? i.gramos : i.cantidad })),
      })
      closeCart(pedidoCart.id)
      toast.success(`"${pedidoCart.nombre}" enviado a caja`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar el pedido a caja')
      // Si el local ya no tiene cajero, volvemos al modo de cobro normal
      if (err.response?.status === 400) loadCajeroConfig()
    } finally {
      setLoading(false)
    }
  }

  const submitSale = async (cliente) => {
    if (enviaACaja) return submitPedido(cliente)
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
      closeCart(saleCart.id)
      toast.success('¡Venta registrada!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrar venta')
      // Se asignó un cajero al local: pasamos a modo "Enviar a caja"
      if (err.response?.status === 403) loadCajeroConfig()
    } finally {
      setLoading(false)
    }
  }

  const handleGuardar = () => {
    // El nombre tipeado tiene prioridad; si no, usamos el que ya está registrado para ese teléfono
    const nombre = clienteForm.nombre.trim() || clienteNombreRegistrado
    if (!nombre) return toast.error('El nombre del cliente es requerido')
    submitSale({
      nombre,
      email: clienteForm.email.trim() || matchedClient?.email || null,
      whatsapp: clienteForm.whatsapp.trim() || null,
    })
  }

  const handleInvitado = () => {
    submitSale({ nombre: 'Invitado', email: null, whatsapp: null })
  }

  // Layout tablet: horizontal → grilla + carrito al costado; vertical → grilla arriba + carrito abajo
  return (
    <div className="h-full flex flex-col landscape:flex-row gap-2 lg:gap-3 touch-manipulation">
      {/* Panel productos */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
        <h1 className="sr-only">Caja</h1>

        {/* Búsqueda (deja lugar al botón de menú fijo a la izquierda) */}
        <div className={`flex items-center gap-2 flex-shrink-0 ${esCajero ? '' : 'pl-[3.25rem]'}`}>
          <div className="relative flex-1 min-w-0">
            <input
              className="input-field h-12 text-base pr-12"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              enterKeyHint="search"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center rounded-xl text-[#444444] active:bg-gray-100"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Categorías */}
        <div className="flex gap-2 overflow-x-auto pb-1 flex-shrink-0">
          {[{ id: '', nombre: 'Todas' }, ...categories].map(c => {
            const isActive = String(catFilter) === String(c.id)
            return (
              <button
                key={c.id || 'all'}
                onClick={() => setCatFilter(c.id === '' ? '' : String(c.id))}
                className={`h-11 px-4 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0 border transition-colors ${
                  isActive
                    ? 'bg-mimi-500 border-mimi-500 text-white'
                    : 'bg-white border-[#E5E7EB] text-[#444444] active:bg-mimi-50'
                }`}
              >
                {c.nombre}
              </button>
            )
          })}
        </div>

        {/* Grilla de productos */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="grid gap-2 sm:gap-3 grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock === 0}
                className="bg-white border border-[#E5E7EB] rounded-2xl shadow-sm text-left p-3 min-h-[7rem] flex flex-col select-none hover:border-mimi-500 hover:shadow-md active:scale-95 active:border-mimi-500 active:bg-mimi-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {p.categoria_nombre && (
                  <span className="self-start max-w-full truncate text-xs bg-mimi-50 text-mimi-500 px-2 py-0.5 rounded-full font-medium mb-1.5">
                    {p.categoria_nombre}
                  </span>
                )}
                <p className="font-semibold text-[#111111] text-base leading-snug line-clamp-2">{p.nombre}</p>
                <div className="mt-auto pt-1.5">
                  <p className="text-mimi-500 font-bold text-lg leading-tight">
                    {fmt(p.precio)}{p.unidad_medida === 'kg' && <span className="text-xs font-normal text-[#444444] ml-1">/kg</span>}
                  </p>
                  {p.unidad_medida === 'kg'
                    ? <p className="text-xs text-orange-500 font-medium">Por peso</p>
                    : <p className="text-xs text-[#444444]">Stock: {p.stock}</p>
                  }
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-[#444444] py-12">No se encontraron productos</p>
            )}
          </div>
        </div>
      </div>

      {/* Panel carrito */}
      <section className="flex-shrink-0 flex flex-col gap-2 min-h-0 portrait:h-[42%] landscape:w-[22rem] xl:landscape:w-96">
        {/* Pestañas de carritos (el "+" queda fijo al final, fuera del scroll) */}
        <div className="flex items-start gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
            {carts.map(c => {
              const isActive = c.id === activeCart.id
              const count = cartCount(c)
              return (
                <div
                  key={c.id}
                  className={`h-12 flex items-center rounded-xl flex-shrink-0 border transition-colors ${
                    isActive ? 'bg-mimi-500 border-mimi-500 text-white' : 'bg-white border-[#E5E7EB] text-[#444444]'
                  }`}
                >
                  {editingCartId === c.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') cancelRename() }}
                      enterKeyHint="done"
                      className="w-36 h-10 mx-1 text-base text-[#111111] rounded-lg px-2 border border-mimi-100 outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setActiveCartId(c.id)}
                      onDoubleClick={() => startRename(c)}
                      title="Doble toque para renombrar"
                      className="h-full pl-3 pr-2 text-sm font-semibold whitespace-nowrap max-w-[10rem] truncate"
                    >
                      {c.nombre}
                      {count > 0 && <span className={isActive ? 'text-white/80 ml-1' : 'text-mimi-500 ml-1'}>·{count}</span>}
                    </button>
                  )}
                  {isActive && editingCartId !== c.id && (
                    <button
                      onClick={() => startRename(c)}
                      aria-label="Renombrar carrito"
                      className="h-full w-9 flex items-center justify-center text-sm active:bg-white/25 rounded-lg"
                    >
                      ✎
                    </button>
                  )}
                  {carts.length > 1 && (
                    <button
                      onClick={() => removeCart(c.id)}
                      aria-label="Cerrar carrito"
                      className={`h-full w-10 flex items-center justify-center text-sm flex-shrink-0 rounded-r-xl ${
                        isActive ? 'active:bg-white/25' : 'active:bg-gray-100'
                      }`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <button
            onClick={addCart}
            aria-label="Nuevo carrito"
            className="flex-shrink-0 w-12 h-12 rounded-xl border-2 border-dashed border-mimi-100 text-mimi-500 text-2xl font-bold active:bg-mimi-50 flex items-center justify-center"
          >
            +
          </button>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-sm flex flex-col portrait:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Items */}
          <div className="flex-1 min-h-0 min-w-0 flex flex-col">
            <div className="px-3 h-12 border-b border-[#E5E7EB] flex items-center justify-between gap-2 flex-shrink-0">
              <h2 className="text-base font-bold text-[#111111] truncate">{activeCart.nombre}</h2>
              {cart.length > 0 && (
                <button
                  onClick={clearActiveCart}
                  className="h-10 px-3 -mr-1 rounded-lg text-sm text-[#444444] active:bg-red-50 active:text-red-500 hover:text-red-500 flex-shrink-0"
                >
                  Vaciar
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-2">
              {cart.length === 0 && (
                <p className="text-sm text-[#444444] text-center py-8">El carrito está vacío</p>
              )}
              {cart.map(item => (
                <div key={`${item.product_id}-${item.es_peso ? item.gramos : 'u'}`} className="border border-[#E5E7EB] rounded-xl p-2">
                  <div className="flex items-start justify-between gap-2 px-1">
                    <p className="text-sm font-semibold text-[#111111] leading-tight line-clamp-2">{item.nombre}</p>
                    <p className="text-sm font-bold text-[#111111] whitespace-nowrap">{fmt(itemTotal(item))}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {item.es_peso
                      ? <p className="flex-1 min-w-0 pl-1 text-xs text-orange-500 font-medium">{item.gramos}g · {fmt(item.precio_unitario)}/kg</p>
                      : <p className="flex-1 min-w-0 pl-1 text-xs text-mimi-500 font-medium">{fmt(item.precio_unitario)} c/u</p>
                    }
                    {item.es_peso ? (
                      <button
                        onClick={() => { setGramosInput(String(item.gramos)); setWeightPopup(products.find(p => p.id === item.product_id)) }}
                        className="h-11 px-3 rounded-xl bg-orange-50 text-orange-600 text-sm font-semibold active:bg-orange-100 flex-shrink-0"
                      >
                        ✎ Editar
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => updateQty(item.product_id, -1)}
                          aria-label="Restar uno"
                          className="w-11 h-11 rounded-xl bg-mimi-50 text-mimi-500 font-bold text-xl flex items-center justify-center active:bg-mimi-100"
                        >
                          −
                        </button>
                        <span className="w-9 text-center text-base font-bold">{item.cantidad}</span>
                        <button
                          onClick={() => updateQty(item.product_id, 1)}
                          aria-label="Sumar uno"
                          className="w-11 h-11 rounded-xl bg-mimi-50 text-mimi-500 font-bold text-xl flex items-center justify-center active:bg-mimi-100"
                        >
                          +
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => removeItem(item.product_id)}
                      aria-label="Quitar producto"
                      className="w-11 h-11 rounded-xl text-red-400 active:bg-red-50 active:text-red-600 flex items-center justify-center flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumen: total, pago y acción principal */}
          <div className="flex-shrink-0 flex flex-col justify-end gap-3 p-3 border-t portrait:border-t-0 portrait:border-l border-[#E5E7EB] portrait:w-64 portrait:overflow-y-auto">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-[#444444]">Total</span>
              <span className="text-2xl font-bold text-mimi-500 leading-none">{fmt(total)}</span>
            </div>

            {/* Pago (con cajero, el medio de pago lo elige el cajero al cobrar) */}
            {!enviaACaja && (
              <div>
                <p className="text-xs font-semibold text-[#444444] uppercase tracking-wide mb-1.5">Método de pago</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setMetodoPago(m.value)}
                      className={`min-h-[2.75rem] px-2 py-1 rounded-xl border text-sm font-semibold leading-tight transition-colors ${
                        metodoPago === m.value
                          ? 'bg-mimi-500 border-mimi-500 text-white'
                          : 'bg-white border-[#E5E7EB] text-[#444444] active:bg-mimi-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {enviaACaja ? (
              <button onClick={openModal} disabled={loading || cart.length === 0} className="btn-primary w-full h-14 text-lg active:bg-mimi-700">
                {loading ? 'Enviando...' : '→ Enviar a caja'}
              </button>
            ) : (
              <button onClick={openModal} disabled={loading || cart.length === 0} className="btn-primary w-full h-14 text-lg active:bg-mimi-700">
                {loading ? 'Registrando...' : esCajero ? '✓ Cobrar' : '✓ Confirmar venta'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Modal datos del cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 sm:p-6">
            <h2 className="text-xl font-bold text-[#111111] mb-1">Datos del cliente</h2>
            <p className="text-sm text-[#444444] mb-4">Ingresá el teléfono del cliente o continuá como invitado.</p>
            <div className="space-y-3">
              <div>
                <input
                  className="input-field h-12 text-base"
                  placeholder="Teléfono / WhatsApp"
                  inputMode="tel"
                  value={clienteForm.whatsapp}
                  onChange={e => setClienteForm(f => ({ ...f, whatsapp: e.target.value }))}
                  autoFocus
                />
                {lookupLoading && (
                  <p className="text-sm text-[#444444] mt-1 ml-1">Buscando cliente…</p>
                )}
                {!lookupLoading && matchedClient && clienteNombreRegistrado && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <p className="text-base font-semibold text-green-700">✓ {clienteNombreRegistrado}</p>
                    <p className="text-sm text-green-600">
                      {matchedClient.nivel ? `${matchedClient.nivel} · ` : ''}{matchedClient.puntos_vigentes ?? 0} pts · No hace falta cargar el nombre
                    </p>
                  </div>
                )}
                {!lookupLoading && matchedClient && !clienteNombreRegistrado && (
                  <p className="text-sm text-orange-600 mt-1 ml-1">Cliente sin nombre registrado — ingresá el nombre.</p>
                )}
              </div>
              <input
                className="input-field h-12 text-base"
                placeholder={nombreObligatorio ? 'Nombre *' : 'Nombre (opcional)'}
                value={clienteForm.nombre}
                onChange={e => setClienteForm(f => ({ ...f, nombre: e.target.value }))}
              />
              <input
                className="input-field h-12 text-base"
                placeholder="Email (opcional)"
                type="email"
                value={clienteForm.email}
                onChange={e => setClienteForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleInvitado} className="flex-1 h-14 rounded-xl border border-[#E5E7EB] text-base font-semibold text-[#444444] hover:bg-gray-50 active:bg-gray-100">
                Invitado
              </button>
              <button onClick={handleGuardar} className="flex-1 h-14 rounded-xl bg-mimi-500 text-white text-base font-semibold hover:bg-mimi-600 active:bg-mimi-700">
                Guardar
              </button>
            </div>
            <button onClick={() => setShowModal(false)} className="w-full mt-2 h-11 rounded-xl text-sm text-[#444444] hover:text-[#111111] active:bg-gray-100">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Popup gramos */}
      {weightPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 sm:p-6">
            <h2 className="text-xl font-bold text-[#111111] mb-0.5">{weightPopup.nombre}</h2>
            <p className="text-sm text-[#444444] mb-5">Precio: {fmt(weightPopup.precio)} por kilo</p>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-[#111111] mb-1">Gramos</label>
              <input
                className="input-field h-16 text-3xl font-bold text-center"
                type="number"
                inputMode="numeric"
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
                className="btn-primary flex-1 h-14 text-base active:bg-mimi-700"
              >
                Agregar al carrito
              </button>
              <button
                onClick={() => { setWeightPopup(null); setGramosInput('') }}
                className="btn-secondary flex-1 h-14 text-base active:bg-mimi-50"
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
