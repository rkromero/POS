const fmtDateTime = (d) => new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
const fmtDay = (d) => new Date(d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

const dif = (item) => (item.cantidad_recibida == null ? null : item.cantidad_recibida - item.cantidad)

export default function RemitoFabrica({ order, onClose }) {
  const items = order.items || []
  const recibido = order.estado === 'recepcionado'
  const num = String(order.id).padStart(5, '0')

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=794,height=1000')
    if (!w) return
    const rows = items.map(i => {
      const d = dif(i)
      const recCell = recibido ? (i.cantidad_recibida == null ? '—' : i.cantidad_recibida) : ''
      const difCell = recibido && d != null
        ? (d === 0 ? 'OK' : (d > 0 ? `+${d}` : `${d}`))
        : ''
      return `
        <tr>
          <td>${i.producto_nombre}</td>
          <td class="center">${i.cantidad}</td>
          <td class="center">${recCell}</td>
          ${recibido ? `<td class="center ${d !== 0 ? 'dif' : ''}">${difCell}</td>` : ''}
        </tr>`
    }).join('')

    w.document.write(`
      <!DOCTYPE html><html lang="es"><head>
      <meta charset="UTF-8"/>
      <title>Remito Pedido #${num}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; font-size: 13px; color:#111; padding: 32px; }
        .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #111; padding-bottom:12px; margin-bottom:16px; }
        .brand { font-size:22px; font-weight:bold; }
        .doc { text-align:right; }
        .doc .t { font-size:18px; font-weight:bold; letter-spacing:1px; }
        .meta { display:flex; flex-wrap:wrap; gap:6px 32px; margin-bottom:18px; font-size:13px; }
        .meta div span { color:#666; }
        table { width:100%; border-collapse:collapse; margin-top:6px; }
        th { text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:.5px; color:#333; border-bottom:2px solid #111; padding:8px 6px; }
        td { padding:8px 6px; border-bottom:1px solid #ddd; font-size:13px; }
        .center { text-align:center; }
        th.center { text-align:center; }
        .dif { color:#c00; font-weight:bold; }
        .notas { margin-top:18px; font-size:12px; color:#333; }
        .notas .lbl { color:#666; }
        .firma { margin-top:48px; display:flex; justify-content:space-between; gap:40px; }
        .firma div { flex:1; border-top:1px solid #111; padding-top:6px; text-align:center; font-size:12px; color:#666; }
        @media print { body { padding:0; } }
      </style>
      </head><body>
        <div class="head">
          <div>
            <div class="brand">${order.local_nombre || 'Mimí'}</div>
            <div style="color:#666;font-size:12px;margin-top:2px">Pedido a Fábrica</div>
          </div>
          <div class="doc">
            <div class="t">REMITO</div>
            <div style="color:#666;font-size:13px">N° ${num}</div>
          </div>
        </div>

        <div class="meta">
          <div><span>Local:</span> <b>${order.local_nombre || ''}</b></div>
          <div><span>Solicitó:</span> <b>${order.user_nombre || ''}</b></div>
          <div><span>Fecha de entrega:</span> <b>${order.fecha_entrega ? fmtDay(order.fecha_entrega) : '—'}</b></div>
          <div><span>Emitido:</span> ${order.created_at ? fmtDateTime(order.created_at) : ''}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th class="center">Cant. pedida</th>
              <th class="center">Cant. recibida</th>
              ${recibido ? '<th class="center">Dif.</th>' : ''}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        ${order.notas ? `<div class="notas"><span class="lbl">Notas del pedido:</span> ${order.notas}</div>` : ''}
        ${recibido && order.notas_recepcion ? `<div class="notas"><span class="lbl">Notas de recepción:</span> ${order.notas_recepcion}</div>` : ''}

        <div class="firma">
          <div>Entregado por (fábrica)</div>
          <div>Recibido por (local)</div>
        </div>
      </body></html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 300)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="overflow-auto flex-1 p-6">
          <div className="flex justify-between items-start border-b-2 border-[#111111] pb-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-[#111111]">{order.local_nombre || 'Mimí'}</h2>
              <p className="text-xs text-[#444444]">Pedido a Fábrica</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tracking-wide text-[#111111]">REMITO</p>
              <p className="text-xs text-[#444444]">N° {num}</p>
            </div>
          </div>

          <div className="text-sm space-y-1 mb-4">
            <p><span className="text-[#444444]">Solicitó:</span> <b>{order.user_nombre}</b></p>
            <p><span className="text-[#444444]">Entrega:</span> <b>{order.fecha_entrega ? fmtDay(order.fecha_entrega) : '—'}</b></p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#444444] border-b-2 border-[#111111]">
                <th className="text-left pb-2">Producto</th>
                <th className="text-center pb-2">Pedido</th>
                {recibido && <th className="text-center pb-2">Recibido</th>}
                {recibido && <th className="text-center pb-2">Dif.</th>}
              </tr>
            </thead>
            <tbody>
              {items.map(i => {
                const d = dif(i)
                return (
                  <tr key={i.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-2 text-[#111111]">{i.producto_nombre}</td>
                    <td className="py-1.5 text-center font-semibold">{i.cantidad}</td>
                    {recibido && <td className="py-1.5 text-center">{i.cantidad_recibida == null ? '—' : i.cantidad_recibida}</td>}
                    {recibido && (
                      <td className={`py-1.5 text-center font-semibold ${d ? 'text-red-600' : 'text-green-600'}`}>
                        {d == null ? '' : d === 0 ? 'OK' : d > 0 ? `+${d}` : d}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {order.notas && (
            <p className="text-xs text-[#444444] mt-3 bg-gray-50 rounded-lg p-2"><b>Notas:</b> {order.notas}</p>
          )}
          {recibido && order.notas_recepcion && (
            <p className="text-xs text-[#444444] mt-2 bg-orange-50 rounded-lg p-2"><b>Recepción:</b> {order.notas_recepcion}</p>
          )}
        </div>

        <div className="flex gap-2 px-6 pb-6 border-t border-[#E5E7EB] pt-4">
          <button onClick={handlePrint} className="btn-secondary flex-1 text-sm">🖨️ Imprimir remito</button>
          <button onClick={onClose} className="btn-primary flex-1 text-sm">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
