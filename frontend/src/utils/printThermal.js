/**
 * Impresión de tickets en comandera térmica de rollo 80 mm.
 *
 * Imprime mediante un iframe oculto (no lo bloquea el bloqueador de popups),
 * espera a que el documento y sus imágenes terminen de cargar antes de llamar
 * a print(), y recién elimina el iframe en `afterprint` (fallback 60 s).
 */

const IMG_TIMEOUT_MS = 2000
const CLEANUP_FALLBACK_MS = 60000

/** Escapa texto para interpolarlo de forma segura en HTML. */
export function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const THERMAL_CSS = `
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 80mm; margin: 0; padding: 0;
    background: #fff; color: #000;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; line-height: 1.3; }
  .ticket { width: 80mm; padding: 2mm 4mm 10mm 4mm; color: #000; }
  .center { text-align: center; }
  .logo { display: block; margin: 0 auto 2mm; max-width: 50mm; max-height: 20mm; filter: grayscale(100%) contrast(200%); }
  .title { font-size: 15px; font-weight: bold; word-break: break-word; }
  .bold { font-weight: bold; }
  .sep { border: 0; border-top: 1px dashed #000; margin: 2.5mm 0; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; }
  .row > :last-child { text-align: right; white-space: nowrap; }
  .item { break-inside: avoid; page-break-inside: avoid; margin-bottom: 1.5mm; }
  .item-name { font-weight: bold; word-break: break-word; overflow-wrap: anywhere; }
  .wrap { word-break: break-word; overflow-wrap: anywhere; }
  .total { font-size: 18px; font-weight: bold; }
  .footer { text-align: center; margin-top: 4mm; font-weight: bold; }
`

function waitForImages(doc) {
  const imgs = Array.from(doc.images || [])
  const pending = imgs
    .filter(img => !img.complete)
    .map(img => new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true })
      img.addEventListener('error', resolve, { once: true })
    }))
  const timeout = new Promise(resolve => setTimeout(resolve, IMG_TIMEOUT_MS))
  return Promise.race([Promise.all(pending), timeout])
}

function waitForLoad(iframe, doc) {
  if (doc.readyState === 'complete') return Promise.resolve()
  return new Promise(resolve => {
    const t = setTimeout(resolve, IMG_TIMEOUT_MS)
    iframe.addEventListener('load', () => { clearTimeout(t); resolve() }, { once: true })
  })
}

/**
 * Chrome descarta `size: 80mm auto` (valor inválido) y cae a A4/Carta.
 * Medimos el alto real del ticket y fijamos @page con ese alto exacto:
 * una sola "página" continua de 80 mm, sin saltos ni hoja en blanco.
 */
export function fitPageToContent(doc) {
  const px = Math.max(doc.documentElement.scrollHeight, doc.body ? doc.body.scrollHeight : 0)
  const mm = Math.ceil((px * 25.4) / 96) + 2
  const style = doc.createElement('style')
  style.textContent = `@page { size: 80mm ${mm}mm; margin: 0; }`
  doc.head.appendChild(style)
}

/** Arma el documento HTML completo del ticket térmico. */
export function buildThermalDocument(htmlBody, { title = 'Ticket' } = {}) {
  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"/>
<title>${escapeHtml(title)}</title>
<style>${THERMAL_CSS}</style>
</head><body><div class="ticket">${htmlBody}</div></body></html>`
}

/**
 * Imprime `htmlBody` (ya escapado) con formato térmico 80 mm.
 * @param {string} htmlBody - contenido interno del ticket
 * @param {{ title?: string }} [options]
 * @returns {Promise<void>}
 */
export async function printThermal(htmlBody, { title = 'Ticket' } = {}) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  // Fuera de pantalla pero con ancho real de 80 mm para que el alto medido sea correcto.
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:80mm;height:10px;border:0;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)

  let removed = false
  const cleanup = () => {
    if (removed) return
    removed = true
    iframe.remove()
  }

  try {
    const win = iframe.contentWindow
    const doc = win.document
    doc.open()
    doc.write(buildThermalDocument(htmlBody, { title }))
    doc.close()

    await waitForLoad(iframe, doc)
    await waitForImages(doc)
    fitPageToContent(doc)

    win.addEventListener('afterprint', () => setTimeout(cleanup, 500), { once: true })
    setTimeout(cleanup, CLEANUP_FALLBACK_MS)

    win.focus()
    win.print()
  } catch (err) {
    console.error('Error al imprimir ticket', err)
    cleanup()
    throw err
  }
}
