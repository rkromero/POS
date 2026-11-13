import { printThermal, escapeHtml } from '../utils/printThermal'

const PAYMENT_LABELS = {
  efectivo: 'Efectivo',
  debito: 'Tarjeta de débito',
  credito: 'Tarjeta de crédito',
  transferencia: 'Transferencia',
}

const formatMoney = (v) => `$${parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
const formatDate = (d) => new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

export default function Ticket({ sale, onClose }) {
  const num = String(sale.numero_comprobante).padStart(6, '0')

  const handlePrint = () => {
    const e = escapeHtml
    const items = (sale.items || []).map(i => {
      const esKg = i.unidad_medida === 'kg'
      const cant = esKg ? `${i.cantidad}g` : `${i.cantidad}`
      const punit = esKg ? `${formatMoney(i.precio_unitario)}/kg` : formatMoney(i.precio_unitario)
      return `
        <div class="item">
          <div class="item-name">${e(i.producto_nombre)}</div>
          <div class="row"><span>${e(cant)} x ${e(punit)}</span><span>${e(formatMoney(i.subtotal))}</span></div>
        </div>`
    }).join('')

    const body = `
      <div class="center">
        ${sale.local_logo ? `<img src="${e(sale.local_logo)}" class="logo" alt="" onerror="this.style.display='none'" />` : ''}
        <div class="title">${e(sale.local_nombre)}</div>
        <div>Comprobante #${e(num)}</div>
        <div>${e(formatDate(sale.created_at))}</div>
      </div>
      <hr class="sep" />
      <div class="wrap"><span class="bold">Cliente:</span> ${e(sale.cliente_nombre)}</div>
      ${sale.cliente_email ? `<div class="wrap">${e(sale.cliente_email)}</div>` : ''}
      ${sale.cliente_whatsapp ? `<div class="wrap">WhatsApp: ${e(sale.cliente_whatsapp)}</div>` : ''}
      <hr class="sep" />
      ${items}
      <hr class="sep" />
      <div>Método: ${e(PAYMENT_LABELS[sale.metodo_pago] || sale.metodo_pago)}</div>
      <div class="row total"><span>TOTAL</span><span>${e(formatMoney(sale.total))}</span></div>
      <hr class="sep" />
      <p class="footer">¡Gracias por su compra!</p>
    `
    printThermal(body, { title: `Comprobante #${num}` }).catch(() => {})
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[90dvh] flex flex-col">
        <div className="overflow-auto flex-1 p-6">
          {/* Header */}
          <div className="text-center mb-4">
            {sale.local_logo && (
              <img src={sale.local_logo} alt={sale.local_nombre} className="h-12 mx-auto mb-2 object-contain" />
            )}
            <h2 className="text-lg font-bold text-[#111111]">{sale.local_nombre}</h2>
            <p className="text-sm text-[#444444]">Comprobante #{num}</p>
            <p className="text-xs text-[#444444]">{formatDate(sale.created_at)}</p>
          </div>

          <hr className="border-dashed border-[#E5E7EB] my-3" />

          <div className="text-sm mb-3">
            <p className="font-semibold">Cliente: {sale.cliente_nombre}</p>
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
              Pago: {PAYMENT_LABELS[sale.metodo_pago]}
            </p>
            <div className="text-right">
              <p className="text-xs text-[#444444]">Total</p>
              <p className="text-2xl font-bold text-mimi-500">{formatMoney(sale.total)}</p>
            </div>
          </div>

          <p className="text-center text-xs text-[#444444] mt-4">¡Gracias por su compra!</p>
        </div>

        <div className="flex gap-2 px-6 pb-6 border-t border-[#E5E7EB] pt-4">
          <button onClick={handlePrint} className="btn-secondary flex-1 text-sm min-h-[3rem]">
            🖨️ Imprimir
          </button>
          <button onClick={onClose} className="btn-primary flex-1 text-sm min-h-[3rem]">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
