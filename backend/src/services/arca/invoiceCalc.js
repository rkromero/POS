// Cálculos puros de la factura (sin I/O).
// El emisor es Monotributista => Factura C: no discrimina IVA (ImpNeto = ImpTotal, ImpIVA = 0).

const CBTE_TIPO_FACTURA_C = 11;

const toCents = (v) => Math.round(Number(v) * 100);
const fromCents = (c) => Math.round(c) / 100;

/**
 * @param {Array<{subtotal:number|string}>} items
 * @param {{ total?: number|string }} [opts] total cobrado de la venta. Si se informa, es el
 *   importe facturado (coincide con el ticket); si no, se usa la suma de los subtotales.
 * @returns {{ imp_total:number, imp_neto:number, imp_iva:number, imp_op_ex:number, alicuotas:[] }}
 */
function calcularFactura(items, opts = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('La factura debe tener al menos un ítem');
  }
  let sumaC = 0;
  for (const it of items) {
    const c = toCents(it.subtotal);
    if (!Number.isFinite(c) || c < 0) throw new Error(`Subtotal inválido: ${it.subtotal}`);
    sumaC += c;
  }
  let totalC = sumaC;
  if (opts.total !== undefined && opts.total !== null) {
    const objetivo = toCents(opts.total);
    // Sólo se tolera la diferencia de redondeo por ítem (1 centavo por ítem como máximo)
    if (!Number.isFinite(objetivo) || Math.abs(objetivo - sumaC) > items.length) {
      throw new Error(`El total (${opts.total}) no coincide con la suma de los ítems (${fromCents(sumaC)})`);
    }
    totalC = objetivo;
  }
  if (totalC <= 0) throw new Error('El importe a facturar debe ser mayor a cero');
  const total = fromCents(totalC);
  return { imp_total: total, imp_neto: total, imp_iva: 0, imp_op_ex: 0, alicuotas: [] };
}

function formatFechaISO(fecha) {
  if (fecha instanceof Date) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(fecha);
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s.slice(0, 10);
}

/**
 * URL del código QR obligatorio (RG 4291).
 * @param {{fecha:string|Date, cuit:string|number, ptoVta:number, tipoCmp?:number, nroCmp:number,
 *   importe:number, tipoDocRec:number, nroDocRec:number|string, codAut:string|number}} d
 */
function buildQrUrl(d) {
  const data = {
    ver: 1,
    fecha: formatFechaISO(d.fecha),
    cuit: Number(d.cuit),
    ptoVta: Number(d.ptoVta),
    tipoCmp: Number(d.tipoCmp || CBTE_TIPO_FACTURA_C),
    nroCmp: Number(d.nroCmp),
    importe: Number(d.importe),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: Number(d.tipoDocRec),
    nroDocRec: Number(d.nroDocRec || 0),
    tipoCodAut: 'E',
    codAut: Number(d.codAut),
  };
  const b64 = Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
  return `https://www.afip.gob.ar/fe/qr/?p=${b64}`;
}

// Tipos de documento del receptor admitidos: 99 consumidor final, 96 DNI, 80 CUIT
const DOC_TIPOS = [99, 96, 80];

function cuitValido(cuit) {
  const s = String(cuit);
  if (!/^\d{11}$/.test(s)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(s[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) return false;
  return dv === Number(s[10]);
}

/**
 * Normaliza y valida el documento del receptor. Sin datos => consumidor final (99 / 0).
 * Lanza Error con mensaje legible si es inválido.
 */
function normalizarReceptor({ doc_tipo, doc_nro } = {}) {
  if (doc_tipo === undefined || doc_tipo === null || doc_tipo === '') return { doc_tipo: 99, doc_nro: 0 };
  const tipo = Number(doc_tipo);
  if (!DOC_TIPOS.includes(tipo)) throw new Error('Tipo de documento inválido (99, 96 DNI u 80 CUIT)');
  if (tipo === 99) return { doc_tipo: 99, doc_nro: 0 };
  const nro = String(doc_nro ?? '').replace(/\D/g, '');
  if (tipo === 96 && !/^\d{7,8}$/.test(nro)) throw new Error('DNI inválido (7 u 8 dígitos)');
  if (tipo === 80 && !cuitValido(nro)) throw new Error('CUIT inválido');
  return { doc_tipo: tipo, doc_nro: Number(nro) };
}

module.exports = {
  CBTE_TIPO_FACTURA_C, DOC_TIPOS, calcularFactura, buildQrUrl, formatFechaISO,
  cuitValido, normalizarReceptor,
};
