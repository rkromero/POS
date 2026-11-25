const pool = require('../db/pool');
const { getCuit } = require('./arca/config');
const { buildQrUrl, formatFechaISO, normalizarReceptor } = require('./arca/invoiceCalc');

const METODOS_PAGO = ['efectivo', 'debito', 'credito', 'transferencia'];
const TIPOS_TICKET = ['mostrador', 'fiscal'];

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Valida tipo_ticket y documento del receptor del body. Lanza httpError(400) si son inválidos.
function parseFiscalInput(body = {}) {
  const tipo_ticket = body.tipo_ticket === undefined || body.tipo_ticket === null || body.tipo_ticket === ''
    ? 'mostrador' : body.tipo_ticket;
  if (!TIPOS_TICKET.includes(tipo_ticket)) throw httpError(400, "tipo_ticket inválido ('mostrador' o 'fiscal')");
  if (tipo_ticket !== 'fiscal') return { tipo_ticket, doc_tipo: null, doc_nro: null };
  try {
    return { tipo_ticket, ...normalizarReceptor({ doc_tipo: body.doc_tipo, doc_nro: body.doc_nro }) };
  } catch (err) {
    throw httpError(400, err.message);
  }
}

// Indica si el local tiene al menos un usuario cajero activo asignado
async function localTieneCajero(local_id, db = pool) {
  if (!local_id) return false;
  const r = await db.query(
    "SELECT 1 FROM users WHERE role='cajero' AND activo=TRUE AND local_id=$1 LIMIT 1",
    [local_id]
  );
  return r.rows.length > 0;
}

// Calcula precios y total de los items con los precios actuales de los productos.
// Si lockForUpdate=true bloquea las filas de products (FOR UPDATE) y valida stock.
// Productos por kg: la cantidad viene en gramos y el precio es por kg (no se valida stock).
async function priceItems(db, items, { lockForUpdate = false, validateStock = false } = {}) {
  let total = 0;
  const validatedItems = [];
  for (const item of items) {
    const prod = await db.query(
      `SELECT id, nombre, precio, stock, unidad_medida FROM products WHERE id=$1 AND activo=TRUE${lockForUpdate ? ' FOR UPDATE' : ''}`,
      [item.product_id]
    );
    if (!prod.rows[0]) {
      throw httpError(400, `Producto ${item.product_id} no encontrado o inactivo`);
    }
    const p = prod.rows[0];
    const esKg = p.unidad_medida === 'kg';
    if (validateStock && !esKg && p.stock < item.cantidad) {
      throw httpError(400, `Stock insuficiente para ${p.nombre} (disponible: ${p.stock})`);
    }
    const precioBase = parseFloat(p.precio);
    const subtotal = esKg ? precioBase * (item.cantidad / 1000) : precioBase * item.cantidad;
    total += subtotal;
    validatedItems.push({ ...item, precio_unitario: p.precio, subtotal, esKg });
  }
  return { total, validatedItems };
}

/**
 * Crea una venta dentro de una transacción ya abierta (el caller hace BEGIN/COMMIT/ROLLBACK).
 * Valida stock con FOR UPDATE, calcula el total, inserta sale + sale_items y descuenta stock.
 * Lanza errores con .status (400) si faltan datos o no hay stock.
 * @returns {Promise<number>} id de la venta creada
 */
async function createSaleTx(client, {
  local_id, user_id, metodo_pago, items, cliente_nombre, cliente_email, cliente_whatsapp,
  tipo_ticket = 'mostrador', doc_tipo = null, doc_nro = null,
}) {
  if (!cliente_nombre) throw httpError(400, 'El nombre del cliente es requerido');
  if (!metodo_pago) throw httpError(400, 'El método de pago es requerido');
  if (!METODOS_PAGO.includes(metodo_pago)) throw httpError(400, 'Método de pago inválido');
  if (!items || items.length === 0) throw httpError(400, 'La venta debe tener al menos un producto');
  if (!local_id) throw httpError(400, 'local_id es requerido');

  const { total, validatedItems } = await priceItems(client, items, { lockForUpdate: true, validateStock: true });

  const saleResult = await client.query(
    `INSERT INTO sales (local_id, user_id, cliente_nombre, cliente_email, cliente_whatsapp, metodo_pago, total,
       tipo_ticket, doc_tipo, doc_nro)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [local_id, user_id, cliente_nombre, cliente_email || null, cliente_whatsapp || null, metodo_pago, total,
     TIPOS_TICKET.includes(tipo_ticket) ? tipo_ticket : 'mostrador', doc_tipo, doc_nro]
  );
  const saleId = saleResult.rows[0].id;

  for (const item of validatedItems) {
    await client.query(
      'INSERT INTO sale_items (sale_id, product_id, cantidad, precio_unitario, subtotal) VALUES ($1,$2,$3,$4,$5)',
      [saleId, item.product_id, item.cantidad, item.precio_unitario, item.subtotal]
    );
    if (!item.esKg) {
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.cantidad, item.product_id]);
    }
  }

  return saleId;
}

// Datos del emisor para el ticket fiscal (null-safe si falta configuración)
async function getEmisor(db = pool) {
  let cfg = {};
  try {
    const r = await db.query('SELECT * FROM arca_config WHERE id=1');
    cfg = r.rows[0] || {};
  } catch { /* tabla aún no migrada */ }
  return {
    razon_social: cfg.razon_social || null,
    cuit: getCuit(),
    domicilio_comercial: cfg.domicilio_comercial || null,
    iibb: cfg.iibb || null,
    inicio_actividades: cfg.inicio_actividades ? formatFechaISO(cfg.inicio_actividades) : null,
    condicion_iva: cfg.condicion_iva || null,
  };
}

const toNumOrNull = (v) => (v === null || v === undefined ? null : Number(v));

// Devuelve la venta con datos del local, items y datos fiscales (para el ticket)
async function getFullSale(saleId, db = pool) {
  const fullSale = await db.query(
    `SELECT s.*, l.nombre as local_nombre, l.logo_url as local_logo, u.nombre as user_nombre
     FROM sales s JOIN locals l ON l.id=s.local_id LEFT JOIN users u ON u.id=s.user_id WHERE s.id=$1`,
    [saleId]
  );
  const sale = fullSale.rows[0];
  if (!sale) return null;
  const saleItems = await db.query(
    `SELECT si.*, p.nombre as producto_nombre, p.unidad_medida FROM sale_items si JOIN products p ON p.id=si.product_id WHERE si.sale_id=$1 ORDER BY si.id`,
    [saleId]
  );

  // Fechas como 'YYYY-MM-DD' (evita corrimientos de zona horaria) y BIGINT como número
  sale.cae_vto = sale.cae_vto ? formatFechaISO(sale.cae_vto) : null;
  sale.factura_fecha = sale.factura_fecha ? formatFechaISO(sale.factura_fecha) : null;
  sale.cbte_nro = toNumOrNull(sale.cbte_nro);
  sale.doc_nro = toNumOrNull(sale.doc_nro);

  const emisor = await getEmisor(db);
  let qr_url = null;
  if (sale.factura_estado === 'autorizada' && sale.cae && emisor.cuit) {
    qr_url = buildQrUrl({
      fecha: sale.factura_fecha,
      cuit: emisor.cuit,
      ptoVta: sale.punto_venta,
      tipoCmp: sale.cbte_tipo,
      nroCmp: sale.cbte_nro,
      importe: Number(sale.imp_neto) + Number(sale.imp_iva || 0) + Number(sale.imp_op_ex || 0),
      tipoDocRec: sale.doc_tipo || 99,
      nroDocRec: sale.doc_nro || 0,
      codAut: sale.cae,
    });
  }
  return { ...sale, items: saleItems.rows, qr_url, emisor };
}

module.exports = {
  METODOS_PAGO, TIPOS_TICKET, httpError, parseFiscalInput, localTieneCajero, priceItems, createSaleTx,
  getEmisor, getFullSale,
};
