const pool = require('../db/pool');

const METODOS_PAGO = ['efectivo', 'debito', 'credito', 'transferencia'];

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
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
async function createSaleTx(client, { local_id, user_id, metodo_pago, items, cliente_nombre, cliente_email, cliente_whatsapp }) {
  if (!cliente_nombre) throw httpError(400, 'El nombre del cliente es requerido');
  if (!metodo_pago) throw httpError(400, 'El método de pago es requerido');
  if (!METODOS_PAGO.includes(metodo_pago)) throw httpError(400, 'Método de pago inválido');
  if (!items || items.length === 0) throw httpError(400, 'La venta debe tener al menos un producto');
  if (!local_id) throw httpError(400, 'local_id es requerido');

  const { total, validatedItems } = await priceItems(client, items, { lockForUpdate: true, validateStock: true });

  const saleResult = await client.query(
    `INSERT INTO sales (local_id, user_id, cliente_nombre, cliente_email, cliente_whatsapp, metodo_pago, total)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [local_id, user_id, cliente_nombre, cliente_email || null, cliente_whatsapp || null, metodo_pago, total]
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

// Devuelve la venta con datos del local e items (para el ticket)
async function getFullSale(saleId, db = pool) {
  const fullSale = await db.query(
    `SELECT s.*, l.nombre as local_nombre, l.logo_url as local_logo
     FROM sales s JOIN locals l ON l.id=s.local_id WHERE s.id=$1`,
    [saleId]
  );
  const saleItems = await db.query(
    `SELECT si.*, p.nombre as producto_nombre, p.unidad_medida FROM sale_items si JOIN products p ON p.id=si.product_id WHERE si.sale_id=$1`,
    [saleId]
  );
  return { ...fullSale.rows[0], items: saleItems.rows };
}

module.exports = { METODOS_PAGO, httpError, localTieneCajero, priceItems, createSaleTx, getFullSale };
