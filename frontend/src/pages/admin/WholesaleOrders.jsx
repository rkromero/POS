import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

export default function WholesaleOrders() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [clients, setClients] = useState([])
  const [products, setProducts] = useState([])
  const [clientId, setClientId] = useState(searchParams.get('client_id') || '')
  const [notas, setNotas] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [items, setItems] = useState([{ product_id: '', descripcion: '', cantidad: '1', precio_unitario: '' }])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [cr, pr] = await Promise.all([
          api.get('/wholesale-clients'),
          api.get('/products?limit=200&activo=true'),
        ])
        setClients(cr.data)
        setProducts(pr.data.data || [])
      } catch { toast.error('Error al cargar datos') }
    }
    load()
  }, [])

  const addItem = () =>
    setItems(prev => [...prev, { product_id: '', descripcion: '', cantidad: '1', precio_unitario: '' }])

  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const setItemField = (i, key, val) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it))

  const onProductChange = (i, productId) => {
    const prod = products.find(p => p.id === parseInt(productId))
    if (prod) {
      setItems(prev => prev.map((it, idx) =>
        idx === i ? { ...it, product_id: productId, descripcion: prod.nombre, precio_unitario: String(prod.precio) } : it
      ))
    } else {
      setItemField(i, 'product_id', productId)
    }
  }

  const total = items.reduce((sum, it) => {
    return sum + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0)
  }, 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clientId) { toast.error('Seleccioná un cliente'); return }
    const validItems = items.filter(it =>
      (it.product_id || it.descripcion.trim()) && it.cantidad && it.precio_unitario
    )
    if (validItems.length === 0) { toast.error('Agregá al menos un producto con cantidad y precio'); return }

    setSaving(true)
    try {
      await api.post('/wholesale-orders', {
        client_id: parseInt(clientId),
        notas: notas || null,
        fecha_entrega: fechaEntrega || null,
        items: validItems.map(it => ({
          product_id: it.product_id ? parseInt(it.product_id) : null,
          descripcion: it.descripcion.trim() || null,
          cantidad: parseFloat(it.cantidad),
          precio_unitario: parseFloat(it.precio_unitario),
        })),
      })
      toast.success('Pedido mayorista creado')
      navigate('/admin/mayoristas')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear pedido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/mayoristas')}
          className="text-[#444444] hover:text-[#111111] text-sm"
        >
          ← Volver
        </button>
        <h1 className="text-2xl font-bold text-[#111111]">Nuevo Pedido Mayorista</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-[#111111] mb-3">Cliente</h2>
          <select
            className="input-field"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            required
          >
            <option value="">Seleccionar cliente...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#111111]">Productos</h2>
            <button type="button" onClick={addItem} className="text-sm text-[#E91E8C] hover:underline">
              + Agregar ítem
            </button>
          </div>

          <div className="mb-2 hidden sm:grid grid-cols-12 gap-2 text-xs text-[#444444] font-semibold px-0.5">
            <span className="col-span-4">Producto</span>
            <span className="col-span-3">Descripción</span>
            <span className="col-span-2">Cant.</span>
            <span className="col-span-2">Precio unit.</span>
            <span className="col-span-1"></span>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <select
                    className="input-field text-sm"
                    value={item.product_id}
                    onChange={e => onProductChange(i, e.target.value)}
                  >
                    <option value="">Libre</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input
                    className="input-field text-sm"
                    placeholder="Descripción"
                    value={item.descripcion}
                    onChange={e => setItemField(i, 'descripcion', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    className="input-field text-sm"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Cant."
                    value={item.cantidad}
                    onChange={e => setItemField(i, 'cantidad', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    className="input-field text-sm"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Precio"
                    value={item.precio_unitario}
                    onChange={e => setItemField(i, 'precio_unitario', e.target.value)}
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="text-red-400 hover:text-red-600 text-xl leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-4 pt-3 border-t border-[#E5E7EB]">
            <span className="text-sm text-[#444444] mr-2">Total del pedido:</span>
            <span className="text-base font-bold text-[#111111]">{fmt(total)}</span>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-bold text-[#111111] mb-3">Datos adicionales</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#444444] mb-1 block">Fecha de entrega</label>
              <input
                className="input-field"
                type="date"
                value={fechaEntrega}
                onChange={e => setFechaEntrega(e.target.value)}
              />
            </div>
            <textarea
              className="input-field"
              placeholder="Notas (opcional)"
              rows={2}
              value={notas}
              onChange={e => setNotas(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-base">
          {saving ? 'Creando pedido...' : 'Crear Pedido Mayorista'}
        </button>
      </form>
    </div>
  )
}
