import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
const EMPTY_CLIENT = { nombre: '', telefono: '', email: '', direccion: '', notas: '' }

export default function WholesaleClients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [showClientForm, setShowClientForm] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT)

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ monto: '', notas: '' })
  const [savingPayment, setSavingPayment] = useState(false)

  const [expandedOrder, setExpandedOrder] = useState(null)
  const [orderDetails, setOrderDetails] = useState({})

  const loadClients = async () => {
    setLoading(true)
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const res = await api.get(`/wholesale-clients${params}`)
      setClients(res.data)
    } catch { toast.error('Error al cargar clientes') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadClients() }, [search])

  const loadDetail = async (id) => {
    setLoadingDetail(true)
    try {
      const res = await api.get(`/wholesale-clients/${id}`)
      setDetail(res.data)
    } catch { toast.error('Error al cargar detalle') }
    finally { setLoadingDetail(false) }
  }

  const selectClient = (id) => {
    if (selected === id) { setSelected(null); setDetail(null); return }
    setSelected(id)
    setDetail(null)
    setExpandedOrder(null)
    loadDetail(id)
  }

  const saveClient = async (e) => {
    e.preventDefault()
    try {
      if (editingClient) {
        await api.put(`/wholesale-clients/${editingClient}`, clientForm)
        toast.success('Cliente actualizado')
      } else {
        await api.post('/wholesale-clients', clientForm)
        toast.success('Cliente creado')
      }
      setShowClientForm(false)
      setEditingClient(null)
      loadClients()
      if (selected && editingClient === selected) loadDetail(selected)
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
  }

  const openEditClient = (c) => {
    setClientForm({ nombre: c.nombre, telefono: c.telefono || '', email: c.email || '', direccion: c.direccion || '', notas: c.notas || '' })
    setEditingClient(c.id)
    setShowClientForm(true)
  }

  const savePayment = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSavingPayment(true)
    try {
      await api.post('/wholesale-payments', { client_id: selected, ...paymentForm })
      toast.success('Pago registrado')
      setShowPaymentForm(false)
      setPaymentForm({ monto: '', notas: '' })
      loadClients()
      loadDetail(selected)
    } catch (err) { toast.error(err.response?.data?.error || 'Error') }
    finally { setSavingPayment(false) }
  }

  const toggleOrder = async (orderId) => {
    if (expandedOrder === orderId) { setExpandedOrder(null); return }
    setExpandedOrder(orderId)
    if (orderDetails[orderId]) return
    try {
      const res = await api.get(`/wholesale-orders/${orderId}`)
      setOrderDetails(prev => ({ ...prev, [orderId]: res.data }))
    } catch { toast.error('Error al cargar detalle del pedido') }
  }

  const saldoColor = (saldo) => {
    if (saldo <= 0) return 'text-green-600'
    if (saldo < 5000) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#111111]">Clientes Mayoristas</h1>
        <div className="flex gap-2">
          <Link to="/admin/mayoristas/nuevo-pedido" className="btn-secondary text-sm px-4 py-2">
            + Nuevo Pedido
          </Link>
          <button
            onClick={() => { setClientForm(EMPTY_CLIENT); setEditingClient(null); setShowClientForm(true) }}
            className="btn-primary text-sm px-4 py-2"
          >
            + Nuevo Cliente
          </button>
        </div>
      </div>

      <input
        className="input-field mb-4 max-w-sm"
        placeholder="Buscar cliente..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="text-center text-[#444444] py-12">Cargando...</p>
      ) : clients.length === 0 ? (
        <p className="text-center text-[#444444] py-12">No hay clientes mayoristas</p>
      ) : (
        <div className="space-y-3">
          {clients.map(c => (
            <div key={c.id} className="card p-0 overflow-hidden">
              <button
                onClick={() => selectClient(c.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-bold text-[#111111]">
                    {c.nombre}
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium ml-2">
                      {c.tipo_cliente || 'mayorista'}
                    </span>
                  </p>
                  <p className="text-sm text-[#444444]">
                    {c.telefono || '—'}{c.email ? ` · ${c.email}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-xs text-[#444444]">Total vendido</p>
                    <p className="text-sm font-semibold text-[#111111]">{fmt(c.total_ventas)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#444444]">Pagado</p>
                    <p className="text-sm font-semibold text-green-600">{fmt(c.total_pagado)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#444444]">Saldo deudor</p>
                    <p className={`text-sm font-bold ${saldoColor(c.saldo)}`}>{fmt(c.saldo)}</p>
                  </div>
                  <span className="text-[#444444] text-sm">{selected === c.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {selected === c.id && (
                <div className="border-t border-[#E5E7EB] px-5 py-5">
                  {loadingDetail ? (
                    <p className="text-sm text-[#444444]">Cargando detalle...</p>
                  ) : detail ? (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-5">
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-blue-600 mb-1">Total Vendido</p>
                          <p className="text-lg font-bold text-blue-700">{fmt(detail.total_ventas)}</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-green-600 mb-1">Total Pagado</p>
                          <p className="text-lg font-bold text-green-700">{fmt(detail.total_pagado)}</p>
                        </div>
                        <div className={`rounded-lg p-3 text-center ${detail.saldo > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                          <p className={`text-xs mb-1 ${detail.saldo > 0 ? 'text-red-600' : 'text-gray-500'}`}>Saldo Deudor</p>
                          <p className={`text-lg font-bold ${detail.saldo > 0 ? 'text-red-700' : 'text-gray-500'}`}>{fmt(detail.saldo)}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 mb-5 flex-wrap">
                        <button onClick={() => setShowPaymentForm(true)} className="btn-primary text-sm px-4 py-2">
                          $ Registrar Pago
                        </button>
                        <Link
                          to={`/admin/mayoristas/nuevo-pedido?client_id=${c.id}`}
                          className="btn-secondary text-sm px-4 py-2"
                        >
                          + Nuevo Pedido
                        </Link>
                        <button onClick={() => openEditClient(detail)} className="btn-secondary text-sm px-4 py-2">
                          ✎ Editar Cliente
                        </button>
                      </div>

                      <div className="mb-5">
                        <h3 className="text-sm font-bold text-[#111111] mb-2">
                          Pedidos ({detail.orders.length})
                        </h3>
                        {detail.orders.length === 0 ? (
                          <p className="text-sm text-[#444444]">Sin pedidos registrados</p>
                        ) : (
                          <div className="space-y-2">
                            {detail.orders.map(o => (
                              <div key={o.id} className="bg-gray-50 rounded-lg overflow-hidden">
                                <button
                                  onClick={() => toggleOrder(o.id)}
                                  className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-gray-100 transition-colors"
                                >
                                  <div>
                                    <span className="text-sm font-semibold text-[#111111]">Pedido #{o.id}</span>
                                    <span className="text-xs text-[#444444] ml-2">
                                      {new Date(o.created_at).toLocaleDateString('es-AR')}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-[#111111]">{fmt(o.total)}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${
                                      o.estado === 'entregado' ? 'bg-green-100 text-green-700' :
                                      o.estado === 'cancelado' ? 'bg-red-100 text-red-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>{o.estado}</span>
                                    <span className="text-xs text-[#444444]">{expandedOrder === o.id ? '▲' : '▼'}</span>
                                  </div>
                                </button>
                                {expandedOrder === o.id && orderDetails[o.id] && (
                                  <div className="px-4 pb-3 border-t border-gray-200">
                                    <div className="space-y-1 mt-2">
                                      {orderDetails[o.id].items.map(item => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                          <span className="text-[#444444]">
                                            {item.descripcion || item.producto_nombre} × {item.cantidad}
                                          </span>
                                          <span className="text-[#111111] font-semibold">{fmt(item.subtotal)}</span>
                                        </div>
                                      ))}
                                    </div>
                                    {orderDetails[o.id].notas && (
                                      <p className="text-xs text-[#444444] mt-2">Nota: {orderDetails[o.id].notas}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-[#111111] mb-2">
                          Pagos ({detail.payments.length})
                        </h3>
                        {detail.payments.length === 0 ? (
                          <p className="text-sm text-[#444444]">Sin pagos registrados</p>
                        ) : (
                          <div className="space-y-1.5">
                            {detail.payments.map(p => (
                              <div key={p.id} className="flex justify-between items-center bg-green-50 rounded-lg px-4 py-2">
                                <div>
                                  <span className="text-sm text-[#111111]">
                                    {new Date(p.created_at).toLocaleDateString('es-AR')}
                                  </span>
                                  {p.notas && (
                                    <span className="text-xs text-[#444444] ml-2">— {p.notas}</span>
                                  )}
                                </div>
                                <span className="text-sm font-bold text-green-700">{fmt(p.monto)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showClientForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#111111] mb-4">
              {editingClient ? 'Editar Cliente' : 'Nuevo Cliente Mayorista'}
            </h2>
            <form onSubmit={saveClient} className="space-y-3">
              <input
                className="input-field"
                placeholder="Nombre *"
                required
                value={clientForm.nombre}
                onChange={e => setClientForm(f => ({ ...f, nombre: e.target.value }))}
              />
              <input
                className="input-field"
                placeholder="Teléfono"
                value={clientForm.telefono}
                onChange={e => setClientForm(f => ({ ...f, telefono: e.target.value }))}
              />
              <input
                className="input-field"
                type="email"
                placeholder="Email"
                value={clientForm.email}
                onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))}
              />
              <input
                className="input-field"
                placeholder="Dirección"
                value={clientForm.direccion}
                onChange={e => setClientForm(f => ({ ...f, direccion: e.target.value }))}
              />
              <textarea
                className="input-field"
                placeholder="Notas"
                rows={2}
                value={clientForm.notas}
                onChange={e => setClientForm(f => ({ ...f, notas: e.target.value }))}
              />
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-primary flex-1 py-2.5">Guardar</button>
                <button type="button" onClick={() => setShowClientForm(false)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#111111] mb-1">Registrar Pago</h2>
            <p className="text-sm text-[#444444] mb-4">{detail?.nombre}</p>
            {detail && (
              <p className="text-xs bg-red-50 text-red-700 rounded-lg px-3 py-2 mb-4">
                Saldo actual: <strong>{fmt(detail.saldo)}</strong>
              </p>
            )}
            <form onSubmit={savePayment} className="space-y-3">
              <input
                className="input-field"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Monto *"
                required
                value={paymentForm.monto}
                onChange={e => setPaymentForm(f => ({ ...f, monto: e.target.value }))}
              />
              <input
                className="input-field"
                placeholder="Notas (opcional)"
                value={paymentForm.notas}
                onChange={e => setPaymentForm(f => ({ ...f, notas: e.target.value }))}
              />
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={savingPayment} className="btn-primary flex-1 py-2.5">
                  {savingPayment ? 'Registrando...' : 'Registrar Pago'}
                </button>
                <button type="button" onClick={() => setShowPaymentForm(false)} className="btn-secondary flex-1 py-2.5">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
