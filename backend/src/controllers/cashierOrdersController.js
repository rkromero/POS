const pool = require('../db/pool');
const { awardPoints } = require('../services/loyaltyService');
const {
  METODOS_PAGO, localTieneCajero, priceItems, createSaleTx, getFullSale,
} = require('../services/salesService');

const ORDER_SELECT = `
  SELECT co.*, u.nombre as user_nombre, l.nombre as local_nombre,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', coi.id, 'product_id', coi.product_id, 'producto_nombre', p.nombre,
        'unidad_medida', p.unidad_medida, 'cantidad', coi.cantidad,
        'precio_unitario', coi.precio_unitario, 'subtotal', coi.subtotal
      ) ORDER BY coi.id)
      FROM cashier_order_items coi JOIN products p ON p.id = coi.product_id
      WHERE coi.order_id = co.id
    ), '[]'::json) as items
  FROM cashier_orders co
  JOIN users u ON u.id = co.user_id
  JOIN locals l ON l.id = co.local_id`;

const trimOrNull = (v, max) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

// GET /api/pedidos-caja/config — indica al POS si el local trabaja con cajero
async function getConfig(req, res, next) {
  try {
    const local_id = req.user.role === 'admin' ? req.query.local_id : req.user.local_id;
    res.json({ tiene_cajero: await localTieneCajero(local_id) });
  } catch (err) { next(err); }
}

// POST /api/pedidos-caja — el usuario del local envía un carrito a caja (no descuenta stock)
async function create(req, res, next) {
  const client = await pool.connect();
  try {
    const local_id = req.user.local_id;
    if (!local_id) return res.status(400).json({ error: 'El usuario no tiene local asignado' });
    if (!await localTieneCajero(local_id)) {
      return res.status(400).json({ error: 'Este local no tiene cajero: cobrá la venta desde el POS' });
    }

    const { nombre_carrito, cliente_nombre, cliente_email, cliente_whatsapp, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });
    }
    const cleanItems = [];
    for (const item of items) {
      const product_id = Number(item?.product_id);
      const cantidad = Number(item?.cantidad);
      if (!Number.isInteger(product_id) || product_id <= 0 || !Number.isInteger(cantidad) || cantidad <= 0) {
        return res.status(400).json({ error: 'Items inválidos: product_id y cantidad deben ser enteros positivos' });
      }
      cleanItems.push({ product_id, cantidad });
    }

    await client.query('BEGIN');
    // Total estimado con los precios actuales (el definitivo se calcula al cobrar)
    const { total, validatedItems } = await priceItems(client, cleanItems);

    const order = await client.query(
      `INSERT INTO cashier_orders
        (local_id, user_id, nombre_carrito, cliente_nombre, cliente_email, cliente_whatsapp, total_estimado)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [local_id, req.user.id,
       trimOrNull(nombre_carrito, 100), trimOrNull(cliente_nombre, 100) || 'Invitado',
       trimOrNull(cliente_email, 150), trimOrNull(cliente_whatsapp, 30), total]
    );
    const orderId = order.rows[0].id;

    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO cashier_order_items (order_id, product_id, cantidad, precio_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5)`,
        [orderId, item.product_id, item.cantidad, item.precio_unitario, item.subtotal]
      );
    }
    await client.query('COMMIT');

    const full = await pool.query(`${ORDER_SELECT} WHERE co.id = $1`, [orderId]);
    res.status(201).json(full.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

// GET /api/pedidos-caja — pedidos del local (por defecto los 'por_cobrar')
async function getAll(req, res, next) {
  try {
    const { estado = 'por_cobrar', local_id } = req.query;
    if (!['por_cobrar', 'cobrado', 'cancelado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const effectiveLocalId = req.user.role === 'admin' ? local_id : req.user.local_id;
    if (req.user.role !== 'admin' && !effectiveLocalId) {
      return res.status(400).json({ error: 'El usuario no tiene local asignado' });
    }

    const params = [estado];
    const conditions = ['co.estado = $1'];
    if (effectiveLocalId) { params.push(effectiveLocalId); conditions.push(`co.local_id = $${params.length}`); }

    // Pendientes: los más viejos primero (orden de llegada). Historial: los más recientes primero.
    const order = estado === 'por_cobrar' ? 'co.created_at ASC' : 'co.created_at DESC LIMIT 100';
    const result = await pool.query(
      `${ORDER_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY ${order}`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
}

// POST /api/pedidos-caja/:id/cobrar — el cajero cobra el pedido y se crea la venta
async function cobrar(req, res, next) {
  const client = await pool.connect();
  try {
    const { metodo_pago } = req.body;
    if (!METODOS_PAGO.includes(metodo_pago)) {
      return res.status(400).json({ error: 'Método de pago inválido' });
    }
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Pedido inválido' });
    }

    await client.query('BEGIN');
    const orderRes = await client.query('SELECT * FROM cashier_orders WHERE id=$1 FOR UPDATE', [orderId]);
    const order = orderRes.rows[0];
    if (!order || order.local_id !== req.user.local_id) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    if (order.estado !== 'por_cobrar') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Este pedido ya fue cobrado' });
    }

    const itemsRes = await client.query(
      'SELECT product_id, cantidad FROM cashier_order_items WHERE order_id=$1 ORDER BY id',
      [orderId]
    );

    // Misma lógica que una venta directa; user_id = cajero para que entre en su cierre de caja
    const saleId = await createSaleTx(client, {
      local_id: order.local_id,
      user_id: req.user.id,
      metodo_pago,
      items: itemsRes.rows,
      cliente_nombre: order.cliente_nombre || 'Invitado',
      cliente_email: order.cliente_email,
      cliente_whatsapp: order.cliente_whatsapp,
    });

    await client.query(
      `UPDATE cashier_orders
         SET estado='cobrado', cobrado_por=$1, cobrado_at=NOW(), sale_id=$2
       WHERE id=$3`,
      [req.user.id, saleId, orderId]
    );
    await client.query('COMMIT');

    const saleData = await getFullSale(saleId);
    awardPoints(saleData);

    res.json({ pedido_id: orderId, sale: saleData });
  } catch (err) {
    // ROLLBACK: si falta stock el pedido queda 'por_cobrar'
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

// PATCH /api/pedidos-caja/:id/cancel — solo admin. No toca stock (nunca se descontó)
async function cancel(req, res, next) {
  const client = await pool.connect();
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Pedido inválido' });
    }

    await client.query('BEGIN');
    const orderRes = await client.query('SELECT id, estado FROM cashier_orders WHERE id=$1 FOR UPDATE', [orderId]);
    const order = orderRes.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    if (order.estado !== 'por_cobrar') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `No se puede cancelar: el pedido está ${order.estado}` });
    }
    await client.query(
      `UPDATE cashier_orders SET estado='cancelado', cancelado_por=$1, cancelado_at=NOW() WHERE id=$2`,
      [req.user.id, orderId]
    );
    await client.query('COMMIT');

    const full = await pool.query(`${ORDER_SELECT} WHERE co.id = $1`, [orderId]);
    res.json(full.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { getConfig, create, getAll, cobrar, cancel };
