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
    const w = window.open('', '_blank', 'width=420,height=720')
    w.document.write(`
      <!DOCTYPE html><html lang="es"><head>
      <meta charset="UTF-8"/>
      <title>Comprobante #${num}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; font-size: 13px; padding: 24px; max-width: 380px; }
        .center { text-align: center; }
        .logo { max-height: 56px; margin-bottom: 8px; }
        .title { font-size: 17px; font-weight: bold; margin-bottom: 2px; }
        .sub { color: #666; font-size: 12px; }
        .divider { border: none; border-top: 1px dashed #ccc; margin: 12px 0; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th { text-align: left; font-size: 11px; color: #666; padding: 3px 2px; border-bottom: 1px solid #eee; }
        td { padding: 4px 2px; font-size: 12px; vertical-align: top; }
        .right { text-align: right; }
        .total-label { font-size: 12px; color: #666; }
        .total-amount { font-size: 22px; font-weight: bold; color: #E91E8C; }
        .footer { text-align: center; color: #999; font-size: 11px; margin-top: 16px; }
      </style>
      </head><body>
      <div class="center">
        ${sale.local_logo ? `<img src="${sale.local_logo}" class="logo" alt="Logo" />` : ''}
        <div class="title">${sale.local_nombre}</div>
        <div class="sub">Comprobante #${num}</div>
        <div class="sub">${formatDate(sale.created_at)}</div>
      </div>
      <hr class="divider" />
      <div><strong>Cliente:</strong> ${sale.cliente_nombre}</div>
      ${sale.cliente_email ? `<div style="color:#666;font-size:12px">${sale.cliente_email}</div>` : ''}
      ${sale.cliente_whatsapp ? `<div style="color:#666;font-size:12px">WhatsApp: ${sale.cliente_whatsapp}</div>` : ''}
      <hr class="divider" />
      <table>
        <thead><tr>
          <th>Producto</th><th class="right">Cant.</th><th class="right">P.Unit.</th><th class="right">Subtotal</th>
        </tr></thead>
        <tbody>
          ${(sale.items || []).map(i => `
            <tr>
              <td>${i.producto_nombre}</td>
              <td class="right">${i.cantidad}</td>
              <td class="right">${formatMoney(i.precio_unitario)}</td>
              <td class="right">${formatMoney(i.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <hr class="divider" />
      <div style="display:flex;justify-content:space-between;align-items:flex-end">
        <div class="sub">Método: ${PAYMENT_LABELS[sale.metodo_pago] || sale.metodo_pago}</div>
        <div style="text-align:right">
          <div class="total-label">TOTAL</div>
          <div class="total-amount">${formatMoney(sale.total)}</div>
        </div>
      </div>
      <p class="footer">¡Gracias por su compra!</p>
      </body></html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 300)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[90vh] flex flex-col">
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
                  <td className="py-1.5 text-right text-[#444444]">{item.cantidad}</td>
                  <td className="py-1.5 text-right text-[#444444]">{formatMoney(item.precio_unitario)}</td>
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
          <button onClick={handlePrint} className="btn-secondary flex-1 text-sm">
            🖨️ Imprimir
          </button>
          <button onClick={onClose} className="btn-primary flex-1 text-sm">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
