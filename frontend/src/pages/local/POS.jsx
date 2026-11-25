import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import Ticket from '../../components/Ticket'
import ClienteModal from '../../components/pos/ClienteModal'
import WeightPopup from '../../components/pos/WeightPopup'
import CartTabs from '../../components/pos/CartTabs'
import CartItemRow from '../../components/pos/CartItemRow'
import { handleFiscalResult, TIPO_MOSTRADOR } from '../../utils/factura'
import { useAuth } from '../../context/AuthContext'
import { STORAGE_KEY, makeCart, nextClienteName, loadInitial } from '../../utils/posCarts'

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

  // ── Múltiples carritos ──────────────────────────────────────────────
  const initialRef = useRef(null)
  if (!initialRef.current) initialRef.current = loadInitial()
  const [carts, setCarts] = useState(initialRef.current.carts)
  const [activeCartId, setActiveCartId] = useState(initialRef.current.activeCartId)

  const [loading, setLoading] = useState(false)
  const [ticket, setTicket] = useState(null)
  const [showModal, setShowModal] = useState(false)
  // Tipo de comprobante en curso ('fiscal' | 'mostrador' | 'caja'); bloquea el doble envío
  const [busy, setBusy] = useState(false)
  const submittingRef = useRef(false)
  const [weightPopup, setWeightPopup] = useState(null)
  const [weightInitial, setWeightInitial] = useState('')
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


  // ── Items ───────────────────────────────────────────────────────────
  const addToCart = (product) => {
    if (product.unidad_medida === 'kg') {
      setWeightInitial('')
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

  const addWeightToCart = (gramosInput) => {
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

  const openModal = () => {
    if (cart.length === 0) return toast.error('Agregá al menos un producto')
    setShowModal(true)
  }

  // Evita doble envío: marca el envío en curso o devuelve false si ya hay uno
  const beginSubmit = (tipo) => {
    if (submittingRef.current) return false
    submittingRef.current = true
    setBusy(tipo)
    setLoading(true)
    return true
  }
  const endSubmit = () => {
    submittingRef.current = false
    setBusy(false)
    setLoading(false)
  }

  const submitPedido = async (cliente) => {
    const pedidoCart = activeCart
    if (!beginSubmit('caja')) return
    setShowModal(false)
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
      endSubmit()
    }
  }

  // tipo: 'fiscal' (Factura C ARCA) | 'mostrador'; doc: { doc_tipo, doc_nro } opcional
  const submitSale = async (cliente, tipo = TIPO_MOSTRADOR, doc = {}) => {
    if (enviaACaja) return submitPedido(cliente)
    const saleCart = activeCart
    if (!beginSubmit(tipo)) return
    try {
      const res = await api.post('/sales', {
        cliente_nombre: cliente.nombre,
        cliente_email: cliente.email || null,
        cliente_whatsapp: cliente.whatsapp || null,
        metodo_pago: saleCart.metodoPago,
        tipo_ticket: tipo,
        ...doc,
        items: saleCart.items.map(i => ({ product_id: i.product_id, cantidad: i.es_peso ? i.gramos : i.cantidad })),
      })
      setShowModal(false)
      setTicket(res.data)
      closeCart(saleCart.id)
      toast.success('¡Venta registrada!')
      // Factura autorizada → se imprime sola en la comandera; si ARCA falló, avisa
      handleFiscalResult(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrar venta')
      // Se asignó un cajero al local: pasamos a modo "Enviar a caja"
      if (err.response?.status === 403) { setShowModal(false); loadCajeroConfig() }
    } finally {
      endSubmit()
    }
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
        <CartTabs
          carts={carts}
          activeCartId={activeCart.id}
          onSelect={setActiveCartId}
          onRename={renameCart}
          onRemove={removeCart}
          onAdd={addCart}
        />

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
                <CartItemRow
                  key={`${item.product_id}-${item.es_peso ? item.gramos : 'u'}`}
                  item={item}
                  total={itemTotal(item)}
                  onEditWeight={() => { setWeightInitial(String(item.gramos)); setWeightPopup(products.find(p => p.id === item.product_id)) }}
                  onQty={(delta) => updateQty(item.product_id, delta)}
                  onRemove={() => removeItem(item.product_id)}
                />
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

      {/* Modal datos del cliente + elección de comprobante */}
      {showModal && (
        <ClienteModal
          enviaACaja={enviaACaja}
          total={total}
          metodoPagoLabel={PAYMENT_METHODS.find(m => m.value === metodoPago)?.label || metodoPago}
          busy={busy}
          onSubmit={submitSale}
          onCancel={() => setShowModal(false)}
        />
      )}

      {/* Popup gramos */}
      {weightPopup && (
        <WeightPopup
          product={weightPopup}
          initialGramos={weightInitial}
          onAdd={addWeightToCart}
          onCancel={() => setWeightPopup(null)}
        />
      )}

      {ticket && <Ticket sale={ticket} onClose={() => setTicket(null)} />}
    </div>
  )
}
