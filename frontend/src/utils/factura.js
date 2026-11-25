/**
 * Helpers del flujo de facturación electrónica ARCA (Factura C, monotributo) en el cobro.
 */
import toast from 'react-hot-toast'
import { isFiscal, isAutorizada, printSaleTicket } from './ticketHtml'

export const TIPO_FISCAL = 'fiscal'
export const TIPO_MOSTRADOR = 'mostrador'

/**
 * Interpreta el DNI/CUIT tipeado por el cajero.
 * 11 dígitos → CUIT (80); 7-8 dígitos → DNI (96); cualquier otra cosa → se omite.
 * @param {string} raw
 * @returns {{ doc_tipo?: number, doc_nro?: string }}
 */
export function docFields(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 11) return { doc_tipo: 80, doc_nro: digits }
  if (digits.length === 7 || digits.length === 8) return { doc_tipo: 96, doc_nro: digits }
  return {}
}

/** Etiqueta para mostrar qué se detectó en el campo DNI/CUIT. */
export function docHint(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  const f = docFields(digits)
  if (f.doc_tipo === 80) return 'CUIT detectado'
  if (f.doc_tipo === 96) return 'DNI detectado'
  return 'Ingresá 7-8 dígitos (DNI) u 11 (CUIT). Si no, se factura a consumidor final sin documento.'
}

/**
 * Luego de registrar una venta: si es fiscal y quedó autorizada, imprime la
 * factura en la comandera sin pedir otro toque; si ARCA falló, avisa.
 * @param {object} sale - venta completa devuelta por el backend
 */
export function handleFiscalResult(sale) {
  if (!isFiscal(sale)) return
  if (isAutorizada(sale)) {
    toast.success('Factura autorizada por ARCA')
    printSaleTicket(sale).catch(() => toast.error('No se pudo imprimir la factura'))
  } else {
    toast.error(`No se pudo facturar en ARCA${sale.factura_error ? `: ${sale.factura_error}` : ''}`, { duration: 6000 })
  }
}
