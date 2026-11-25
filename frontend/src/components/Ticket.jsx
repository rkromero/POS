import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import {
  PAYMENT_LABELS, DOC_LABELS, formatMoney, formatDateTime, formatDateOnly, formatCuit,
  formatNroFactura, numeroComprobante, cbteInfo, isFiscal, isAutorizada, qrDataUrl, printSaleTicket,
} from '../utils/ticketHtml'

function EmisorHeader({ sale }) {
  const em = sale.emisor || {}
  const cb = cbteInfo(sale)
  return (
    <div className="text-center mb-4 text-xs text-[#444444] space-y-0.5">
      <h2 className="text-lg font-bold text-[#111111]">{em.razon_social || sale.local_nombre}</h2>
      {em.cuit && <p>CUIT: {formatCuit(em.cuit)}</p>}
      {em.iibb && <p>IIBB: {em.iibb}</p>}
      {em.inicio_actividades && <p>Inicio act.: {formatDateOnly(em.inicio_actividades)}</p>}
      {em.domicilio_comercial && <p>{em.domicilio_comercial}</p>}
      {em.condicion_iva && <p>{em.condicion_iva}</p>}
      <div className="pt-2">
        <p className="text-base font-bold text-[#111111]">FACTURA {cb.letra} <span className="text-xs font-normal">Cód. {cb.codigo}</span></p>
        <p>Nro: <span className="font-mono font-semibold">{formatNroFactura(sale.punto_venta, sale.cbte_nro)}</span></p>
        <p>{formatDateTime(sale.created_at)}</p>
      </div>
    </div>
  )
}

function FiscalFooter({ sale }) {
  const [qr, setQr] = useState(null)
  useEffect(() => {
    let cancelled = false
    qrDataUrl(sale.qr_url).then(u => { if (!cancelled) setQr(u) }).catch(() => {})
    return () => { cancelled = true }
  }, [sale.qr_url])

  return (
    <div className="mt-4 text-xs text-[#444444] space-y-1">
      {cbteInfo(sale).discriminaIva && (
        <>
          <p>Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</p>
          <p className="flex justify-between"><span>IVA contenido</span><span className="font-semibold">{formatMoney(sale.imp_iva)}</span></p>
          <hr className="border-dashed border-[#E5E7EB] my-2" />
        </>
      )}
      <p className="flex justify-between"><span>CAE</span><span className="font-mono font-semibold text-[#111111]">{sale.cae}</span></p>
      <p className="flex justify-between"><span>Vto. CAE</span><span>{formatDateOnly(sale.cae_vto)}</span></p>
      {qr && <img src={qr} alt="QR ARCA" className="w-32 h-32 mx-auto mt-2" style={{ imageRendering: 'pixelated' }} />}
      <p className="text-center font-semibold pt-1">Comprobante autorizado por ARCA</p>
    </div>
  )
}

export default function Ticket({ sale: initialSale, onClose, onUpdated }) {
  const [sale, setSale] = useState(initialSale)
  const [retrying, setRetrying] = useState(false)
  useEffect(() => { setSale(initialSale) }, [initialSale])

  const fiscalOk = isAutorizada(sale)
  const fiscalFallida = isFiscal(sale) && !fiscalOk

  const handlePrint = () => {
    printSaleTicket(sale).catch(() => toast.error('No se pudo imprimir'))
  }

  const reintentar = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      const res = await api.post(`/sales/${sale.id}/facturar`)
      setSale(res.data)
      onUpdated?.(res.data)
      if (isAutorizada(res.data)) {
        toast.success('Factura autorizada por ARCA')
        printSaleTicket(res.data).catch(() => toast.error('No se pudo imprimir la factura'))
      } else {
        toast.error(res.data.factura_error || 'ARCA no autorizó la factura')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al reintentar la facturación')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[90dvh] flex flex-col">
        <div className="overflow-auto flex-1 p-6">
          {fiscalFallida && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
              <p className="font-bold">
                {sale.factura_estado === 'pendiente' ? 'Factura pendiente en ARCA' : 'No se pudo facturar en ARCA'}
              </p>
              {sale.factura_error && <p className="text-xs mt-0.5 break-words">{sale.factura_error}</p>}
              <p className="text-xs mt-1 text-red-600">La venta quedó registrada. Podés reintentar o imprimir ticket de mostrador.</p>
            </div>
          )}

          {fiscalOk ? <EmisorHeader sale={sale} /> : (
            <div className="text-center mb-4">
              {sale.local_logo && (
                <img src={sale.local_logo} alt={sale.local_nombre} className="h-12 mx-auto mb-2 object-contain" />
              )}
              <h2 className="text-lg font-bold text-[#111111]">{sale.local_nombre}</h2>
              <p className="text-sm text-[#444444]">Comprobante #{numeroComprobante(sale)}</p>
              <p className="text-xs text-[#444444]">{formatDateTime(sale.created_at)}</p>
            </div>
          )}

          <hr className="border-dashed border-[#E5E7EB] my-3" />

          <div className="text-sm mb-3">
            {fiscalOk && !sale.doc_nro && <p className="font-semibold">A CONSUMIDOR FINAL</p>}
            {fiscalOk && sale.doc_nro && <p className="font-semibold">{DOC_LABELS[sale.doc_tipo] || 'Doc.'}: {sale.doc_nro}</p>}
            <p className={fiscalOk ? 'text-[#444444]' : 'font-semibold'}>Cliente: {sale.cliente_nombre}</p>
            {sale.cliente_email && <p className="text-[#444444]">{sale.cliente_email}</p>}
            {sale.cliente_whatsapp && <p className="text-[#444444]">WhatsApp: {sale.cliente_whatsapp}</p>}
          </div>

          <hr className="border-dashed border-[#E5E7EB] my-3" />

          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#444444] border-b border-[#E5E7EB]">
                <th className="text-left pb-2">Producto</th>
                <th className="text-right pb-2">Cant.</th>
                <th className="text-right pb-2">P.Unit</th>
                <th className="text-right pb-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(sale.items || []).map(item => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="py-1.5 pr-2 text-[#111111]">{item.producto_nombre}</td>
                  <td className="py-1.5 text-right text-[#444444]">{item.unidad_medida === 'kg' ? `${item.cantidad}g` : item.cantidad}</td>
                  <td className="py-1.5 text-right text-[#444444]">{formatMoney(item.precio_unitario)}{item.unidad_medida === 'kg' ? '/kg' : ''}</td>
                  <td className="py-1.5 text-right font-medium">{formatMoney(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <hr className="border-dashed border-[#E5E7EB] my-3" />

          <div className="flex justify-between items-end">
            <p className="text-sm text-[#444444]">
              Pago: {PAYMENT_LABELS[sale.metodo_pago] || sale.metodo_pago}
            </p>
            <div className="text-right">
              <p className="text-xs text-[#444444]">Total</p>
              <p className="text-2xl font-bold text-mimi-500">{formatMoney(sale.total)}</p>
            </div>
          </div>

          {fiscalOk
            ? <FiscalFooter sale={sale} />
            : <p className="text-center text-xs text-[#444444] mt-4">¡Gracias por su compra!</p>}
        </div>

        <div className="px-6 pb-6 border-t border-[#E5E7EB] pt-4 space-y-2">
          {fiscalFallida && (
            <button
              onClick={reintentar}
              disabled={retrying}
              className="btn-primary w-full text-base min-h-[3.25rem]"
            >
              {retrying ? 'Facturando en ARCA…' : '🔁 Reintentar facturación'}
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={handlePrint} disabled={retrying} className="btn-secondary flex-1 text-sm min-h-[3rem]">
              {fiscalOk ? '🖨️ Imprimir factura' : fiscalFallida ? '🖨️ Imprimir mostrador' : '🖨️ Imprimir'}
            </button>
            <button onClick={onClose} disabled={retrying} className="btn-primary flex-1 text-sm min-h-[3rem]">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
