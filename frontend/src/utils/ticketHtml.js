/**
 * Armado del HTML de tickets (mostrador y factura C/B fiscal ARCA) para la
 * comandera térmica, más helpers de formato compartidos con la vista previa.
 */
import QRCode from 'qrcode'
import { printThermal, escapeHtml as e } from './printThermal'

export const PAYMENT_LABELS = {
  efectivo: 'Efectivo',
  debito: 'Tarjeta de débito',
  credito: 'Tarjeta de crédito',
  transferencia: 'Transferencia',
}

export const DOC_LABELS = { 80: 'CUIT', 96: 'DNI' }

export const formatMoney = (v) => `$${parseFloat(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const formatDateTime = (d) => new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

/** "2026-11-25" | "2026-11-25T00:00:00.000Z" → "25/11/2026" (sin corrimiento de zona horaria). */
export function formatDateOnly(value) {
  if (!value) return ''
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-AR')
}

/** "20123456789" → "20-12345678-9" */
export function formatCuit(cuit) {
  const s = String(cuit || '').replace(/\D/g, '')
  return s.length === 11 ? `${s.slice(0, 2)}-${s.slice(2, 10)}-${s.slice(10)}` : String(cuit || '')
}

/** Punto de venta (5 dígitos) + número de comprobante (8 dígitos). */
export const formatNroFactura = (pv, nro) =>
  `${String(pv ?? 0).padStart(5, '0')}-${String(nro ?? 0).padStart(8, '0')}`

/**
 * Letra y código del comprobante según cbte_tipo de ARCA.
 * 11 → Factura C (monotributo, caso por defecto); 6 → Factura B.
 */
export function cbteInfo(sale) {
  if (Number(sale?.cbte_tipo) === 6) return { letra: 'B', codigo: '006', discriminaIva: true }
  return { letra: 'C', codigo: '011', discriminaIva: false }
}

export const numeroComprobante = (sale) => String(sale.numero_comprobante).padStart(6, '0')

export const isFiscal = (sale) => sale?.tipo_ticket === 'fiscal'
export const isAutorizada = (sale) => isFiscal(sale) && sale.factura_estado === 'autorizada' && !!sale.cae

/** Genera el QR de ARCA como data URL PNG (~140 px). */
export function qrDataUrl(url) {
  if (!url) return Promise.resolve(null)
  return QRCode.toDataURL(url, { width: 140, margin: 1, errorCorrectionLevel: 'M' })
}

export function itemCantidadLabel(i) {
  const esKg = i.unidad_medida === 'kg'
  return {
    cant: esKg ? `${i.cantidad}g` : `${i.cantidad}`,
    punit: esKg ? `${formatMoney(i.precio_unitario)}/kg` : formatMoney(i.precio_unitario),
  }
}

function itemsHtml(sale) {
  return (sale.items || []).map(i => {
    const { cant, punit } = itemCantidadLabel(i)
    return `
      <div class="item">
        <div class="item-name">${e(i.producto_nombre)}</div>
        <div class="row"><span>${e(cant)} x ${e(punit)}</span><span>${e(formatMoney(i.subtotal))}</span></div>
      </div>`
  }).join('')
}

const logoHtml = (sale) => sale.local_logo
  ? `<img src="${e(sale.local_logo)}" class="logo" alt="" onerror="this.style.display='none'" />`
  : ''

/** Ticket de mostrador (no fiscal), igual al formato histórico. */
export function buildMostradorHtml(sale) {
  return `
    <div class="center">
      ${logoHtml(sale)}
      <div class="title">${e(sale.local_nombre)}</div>
      <div>Comprobante #${e(numeroComprobante(sale))}</div>
      <div>${e(formatDateTime(sale.created_at))}</div>
    </div>
    <hr class="sep" />
    <div class="wrap"><span class="bold">Cliente:</span> ${e(sale.cliente_nombre)}</div>
    ${sale.cliente_email ? `<div class="wrap">${e(sale.cliente_email)}</div>` : ''}
    ${sale.cliente_whatsapp ? `<div class="wrap">WhatsApp: ${e(sale.cliente_whatsapp)}</div>` : ''}
    <hr class="sep" />
    ${itemsHtml(sale)}
    <hr class="sep" />
    <div>Método: ${e(PAYMENT_LABELS[sale.metodo_pago] || sale.metodo_pago)}</div>
    <div class="row total"><span>TOTAL</span><span>${e(formatMoney(sale.total))}</span></div>
    <hr class="sep" />
    <p class="footer">¡Gracias por su compra!</p>
  `
}

/** Factura C (Cód. 011) — o B si cbte_tipo = 6 — autorizada por ARCA, con CAE y QR. */
export function buildFiscalHtml(sale, qrSrc) {
  const em = sale.emisor || {}
  const cb = cbteInfo(sale)
  const receptor = sale.doc_nro
    ? `<div class="wrap"><span class="bold">${e(DOC_LABELS[sale.doc_tipo] || 'Doc.')}:</span> ${e(sale.doc_nro)}</div>
       ${sale.cliente_nombre && sale.cliente_nombre !== 'Invitado' ? `<div class="wrap">${e(sale.cliente_nombre)}</div>` : ''}
       <div class="small">Consumidor final</div>`
    : '<div class="bold">A CONSUMIDOR FINAL</div>'

  return `
    <div class="center">
      ${logoHtml(sale)}
      <div class="title">${e(em.razon_social || sale.local_nombre)}</div>
      ${em.cuit ? `<div>CUIT: ${e(formatCuit(em.cuit))}</div>` : ''}
      ${em.iibb ? `<div>IIBB: ${e(em.iibb)}</div>` : ''}
      ${em.inicio_actividades ? `<div>Inicio act.: ${e(formatDateOnly(em.inicio_actividades))}</div>` : ''}
      ${em.domicilio_comercial ? `<div class="wrap">${e(em.domicilio_comercial)}</div>` : ''}
      ${em.condicion_iva ? `<div>${e(em.condicion_iva)}</div>` : ''}
    </div>
    <hr class="sep" />
    <div class="center">
      <div class="title">FACTURA ${e(cb.letra)}</div>
      <div>Cód. ${e(cb.codigo)}</div>
    </div>
    <div class="row"><span>Nro:</span><span class="bold">${e(formatNroFactura(sale.punto_venta, sale.cbte_nro))}</span></div>
    <div class="row"><span>Fecha:</span><span>${e(formatDateTime(sale.created_at))}</span></div>
    <hr class="sep" />
    ${receptor}
    <hr class="sep" />
    ${itemsHtml(sale)}
    <hr class="sep" />
    <div class="row total"><span>TOTAL</span><span>${e(formatMoney(sale.total))}</span></div>
    ${cb.discriminaIva ? `<hr class="sep" />
    <div class="small wrap">Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</div>
    <div class="row small"><span>IVA contenido:</span><span>${e(formatMoney(sale.imp_iva))}</span></div>` : ''}
    <hr class="sep" />
    <div>Pago: ${e(PAYMENT_LABELS[sale.metodo_pago] || sale.metodo_pago)}</div>
    <hr class="sep" />
    <div class="row"><span>CAE:</span><span class="bold">${e(sale.cae)}</span></div>
    <div class="row"><span>Vto. CAE:</span><span>${e(formatDateOnly(sale.cae_vto))}</span></div>
    ${qrSrc ? `<img src="${e(qrSrc)}" class="qr" alt="QR ARCA" />` : ''}
    <p class="footer">Comprobante autorizado por ARCA</p>
  `
}

/**
 * Imprime el ticket que corresponde a la venta: factura B si está autorizada
 * en ARCA; si no (o si `forceMostrador`), el ticket de mostrador.
 */
export async function printSaleTicket(sale, { forceMostrador = false } = {}) {
  if (!forceMostrador && isAutorizada(sale)) {
    let qr = null
    try { qr = await qrDataUrl(sale.qr_url) } catch (err) { console.error('Error al generar QR', err) }
    const nro = formatNroFactura(sale.punto_venta, sale.cbte_nro)
    return printThermal(buildFiscalHtml(sale, qr), { title: `Factura ${cbteInfo(sale).letra} ${nro}` })
  }
  return printThermal(buildMostradorHtml(sale), { title: `Comprobante #${numeroComprobante(sale)}` })
}
