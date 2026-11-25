// Emisión de Factura C (emisor Monotributista) con CAE de ARCA para una venta existente.
const pool = require('../../db/pool');
const { getFullSale, httpError } = require('../salesService');
const { isConfigured } = require('./config');
const { calcularFactura, CBTE_TIPO_FACTURA_C } = require('./invoiceCalc');
const wsfe = require('./wsfe');

const CBTE_TIPO = CBTE_TIPO_FACTURA_C; // 11 = Factura C
const CONCEPTO_PRODUCTOS = 1;
const CONDICION_IVA_CONSUMIDOR_FINAL = 5;
const LOCK_NS_FACTURA = 7302; // espacio de advisory locks: (7302, punto de venta)
const LOCK_TIMEOUT = '60s';

// Fecha de hoy en Argentina: { iso: 'YYYY-MM-DD', afip: 'YYYYMMDD' }
function hoyArgentina(now = new Date()) {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  return { iso, afip: iso.replace(/-/g, '') };
}

// 'YYYYMMDD' -> 'YYYY-MM-DD'
function afipToIso(s) {
  const v = String(s || '');
  return /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null;
}

const cents = (v) => Math.round(Number(v) * 100);

async function marcarError(db, saleId, mensaje, { conservarNumero = false } = {}) {
  await db.query(
    `UPDATE sales SET factura_estado='error', factura_error=$2,
       cbte_nro = CASE WHEN $3::boolean THEN cbte_nro ELSE NULL END
     WHERE id=$1 AND (factura_estado IS DISTINCT FROM 'autorizada')`,
    [saleId, String(mensaje).slice(0, 2000), conservarNumero]
  );
}

async function marcarAutorizada(db, saleId, { cae, caeVto, fecha, calc, nro, pv }) {
  await db.query(
    `UPDATE sales SET factura_estado='autorizada', factura_error=NULL,
       cae=$2, cae_vto=$3, factura_fecha=$4, imp_neto=$5, imp_iva=$6, imp_op_ex=$7,
       cbte_nro=$8, punto_venta=$9, cbte_tipo=$10
     WHERE id=$1`,
    [saleId, cae, caeVto, fecha, calc.imp_neto, calc.imp_iva, calc.imp_op_ex, nro, pv, CBTE_TIPO]
  );
}

async function cargarVenta(db, saleId) {
  const r = await db.query(
    `SELECT s.*, l.arca_punto_venta FROM sales s JOIN locals l ON l.id = s.local_id WHERE s.id=$1`,
    [saleId]
  );
  return r.rows[0] || null;
}

/**
 * Si un intento anterior quedó incierto (p. ej. timeout), consulta ese número en ARCA y,
 * si el comprobante existe con el mismo importe y documento y no pertenece a otra venta,
 * adopta su CAE. Devuelve true si la venta quedó autorizada.
 */
async function intentarRecuperar(db, sale, pv, calc) {
  if (!sale.cbte_nro || Number(sale.punto_venta) !== pv || Number(sale.cbte_tipo) !== CBTE_TIPO) return false;
  const nro = Number(sale.cbte_nro);
  const comp = await wsfe.feCompConsultar(pv, CBTE_TIPO, nro);
  if (!comp || !comp.CodAutorizacion) return false;

  const mismoImporte = cents(comp.ImpTotal) === cents(calc.imp_total);
  const mismoDoc = Number(comp.DocTipo) === Number(sale.doc_tipo || 99)
    && Number(comp.DocNro) === Number(sale.doc_nro || 0);
  const otra = await db.query(
    `SELECT 1 FROM sales WHERE cbte_tipo=$1 AND punto_venta=$2 AND cbte_nro=$3 AND cae IS NOT NULL AND id<>$4`,
    [CBTE_TIPO, pv, nro, sale.id]
  );
  if (!mismoImporte || !mismoDoc || otra.rows.length) return false;

  await marcarAutorizada(db, sale.id, {
    cae: String(comp.CodAutorizacion),
    caeVto: afipToIso(comp.FchVto),
    fecha: afipToIso(comp.CbteFch),
    calc, nro, pv,
  });
  return true;
}

function armarSolicitud({ pv, nro, fecha, calc, docTipo, docNro }) {
  return {
    FeCabReq: { CantReg: 1, PtoVta: pv, CbteTipo: CBTE_TIPO },
    FeDetReq: {
      // El orden de los campos respeta el WSDL de WSFEv1
      FECAEDetRequest: {
        Concepto: CONCEPTO_PRODUCTOS,
        DocTipo: docTipo,
        DocNro: docNro,
        CbteDesde: nro,
        CbteHasta: nro,
        CbteFch: fecha,
        ImpTotal: calc.imp_total.toFixed(2),
        ImpTotConc: '0.00',
        ImpNeto: calc.imp_neto.toFixed(2),
        ImpOpEx: '0.00',
        ImpTrib: '0.00',
        ImpIVA: '0.00',
        MonId: 'PES',
        MonCotiz: 1,
        CondicionIVAReceptorId: CONDICION_IVA_CONSUMIDOR_FINAL,
        // Factura C: sin bloque Iva/AlicIva
      },
    },
  };
}

/**
 * Emite (o reintenta) la Factura C de una venta. Nunca lanza por errores de ARCA:
 * el resultado queda en sales.factura_estado / factura_error. Devuelve la venta completa.
 * Lanza httpError(404) si la venta no existe.
 */
async function emitirFactura(saleId) {
  const client = await pool.connect();
  let lockPv = null;
  try {
    let sale = await cargarVenta(client, saleId);
    if (!sale) throw httpError(404, 'Venta no encontrada');
    if (sale.factura_estado === 'autorizada') return await getFullSale(saleId, client);

    await client.query(`UPDATE sales SET tipo_ticket='fiscal' WHERE id=$1`, [saleId]);

    if (!isConfigured()) {
      await marcarError(client, saleId, 'Facturación electrónica no configurada: faltan ARCA_CUIT, ARCA_CERT o ARCA_KEY en el servidor');
      return await getFullSale(saleId, client);
    }
    const pv = Number(sale.arca_punto_venta);
    if (!Number.isInteger(pv) || pv <= 0) {
      await marcarError(client, saleId, 'El local no tiene punto de venta ARCA configurado');
      return await getFullSale(saleId, client);
    }

    const items = await client.query('SELECT subtotal FROM sale_items WHERE sale_id=$1', [saleId]);
    let calc;
    try {
      calc = calcularFactura(items.rows, { total: sale.total });
    } catch (err) {
      await marcarError(client, saleId, err.message);
      return await getFullSale(saleId, client);
    }

    // Serializa la numeración por punto de venta
    await client.query(`SET lock_timeout = '${LOCK_TIMEOUT}'`);
    await client.query('SELECT pg_advisory_lock($1, $2)', [LOCK_NS_FACTURA, pv]);
    lockPv = pv;

    // Releer bajo el lock: otro pedido pudo haberla autorizado mientras esperábamos
    sale = await cargarVenta(client, saleId);
    if (sale.factura_estado === 'autorizada') return await getFullSale(saleId, client);

    let nro = null;
    let autorizadaEnArca = false;
    try {
      if (await intentarRecuperar(client, sale, pv, calc)) return await getFullSale(saleId, client);

      nro = (await wsfe.feCompUltimoAutorizado(pv, CBTE_TIPO)) + 1;
      const fecha = hoyArgentina();
      const docTipo = Number(sale.doc_tipo || 99);
      const docNro = docTipo === 99 ? 0 : Number(sale.doc_nro || 0);

      // Se guarda el número ANTES de pedir el CAE, para poder recuperarlo si se pierde la respuesta
      await client.query(
        `UPDATE sales SET factura_estado='pendiente', factura_error=NULL, cbte_tipo=$2, punto_venta=$3,
           cbte_nro=$4, imp_neto=$5, imp_iva=$6, imp_op_ex=$7, doc_tipo=$8, doc_nro=$9
         WHERE id=$1`,
        [saleId, CBTE_TIPO, pv, nro, calc.imp_neto, calc.imp_iva, calc.imp_op_ex, docTipo, docNro]
      );

      const resp = await wsfe.feCAESolicitar(armarSolicitud({ pv, nro, fecha: fecha.afip, calc, docTipo, docNro }));
      if (resp.resultado === 'A' && resp.cae) {
        autorizadaEnArca = true;
        await marcarAutorizada(client, saleId, {
          cae: String(resp.cae),
          caeVto: afipToIso(resp.caeVto),
          fecha: afipToIso(resp.cbteFch) || fecha.iso,
          calc, nro, pv,
        });
      } else {
        await marcarError(client, saleId, `Factura rechazada por ARCA${resp.mensaje ? `: ${resp.mensaje}` : ''}`);
      }
    } catch (err) {
      // Si no sabemos si ARCA la autorizó, conservamos el número para recuperarla en el reintento.
      // Si falló antes de pedir un número nuevo, se conserva el de un intento previo (si lo hay).
      // Si ARCA ya la autorizó y falló el guardado, el número DEBE conservarse: el reintento
      // la recupera con FECompConsultar en vez de emitir una factura nueva.
      const incierto = (Boolean(err.incierto) || autorizadaEnArca) && nro !== null;
      const mensaje = err.name === 'ArcaError' ? err.message : `Error al facturar: ${err.message}`;
      console.error(`[ARCA] venta ${saleId}${autorizadaEnArca ? ` (AUTORIZADA en ARCA nro ${nro})` : ''}: ${mensaje}`);
      await marcarError(client, saleId, autorizadaEnArca
        ? `${mensaje}. ARCA autorizó el comprobante ${nro} pero no se pudo guardar: reintentá para recuperarlo`
        : incierto
          ? `${mensaje}. Estado incierto: reintentá para verificar si ARCA la autorizó`
          : mensaje, { conservarNumero: incierto || nro === null });
    }
    return await getFullSale(saleId, client);
  } finally {
    if (lockPv !== null) {
      await client.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_NS_FACTURA, lockPv]).catch(() => {});
    }
    await client.query('RESET lock_timeout').catch(() => {});
    client.release();
  }
}

// Igual que emitirFactura pero nunca lanza: ante un error inesperado (DB, lock_timeout)
// lo registra en la venta. Se usa después de cobrar, cuando la venta ya está confirmada.
async function emitirFacturaSegura(saleId) {
  try {
    await emitirFactura(saleId);
  } catch (err) {
    console.error(`[ARCA] venta ${saleId}: error inesperado al facturar: ${err.message}`);
    await pool.query(
      `UPDATE sales SET factura_estado='error', factura_error=$2
       WHERE id=$1 AND factura_estado IS DISTINCT FROM 'autorizada'`,
      [saleId, `Error al facturar: ${err.message}`.slice(0, 2000)]
    ).catch(() => {});
  }
}

module.exports = { emitirFactura, emitirFacturaSegura, hoyArgentina, armarSolicitud, CBTE_TIPO };
