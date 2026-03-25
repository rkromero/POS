const pool = require('../db/pool');

async function getAll(req, res, next) {
  try {
    const { client_id, estado } = req.query;
    const params = [];
    const conditions = [];
    if (client_id) { params.push(client_id); conditions.push(`wo.client_id = $${params.length}`); }
    if (estado) { params.push(estado); conditions.push(`wo.estado = $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await pool.query(`
      SELECT wo.*, c.nombre AS client_nombre, u.nombre AS user_nombre
      FROM wholesale_orders wo
      JOIN wholesale_clients c ON c.id = wo.client_id
      JOIN users u ON u.id = wo.user_id
      ${where}
      ORDER BY wo.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const order = await pool.query(`
      SELECT wo.*, c.nombre AS client_nombre, u.nombre AS user_nombre
      FROM wholesale_orders wo
      JOIN wholesale_clients c ON c.id = wo.client_id
      JOIN users u ON u.id = wo.user_id
      WHERE wo.id = $1
    `, [req.params.id]);
    if (!order.rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });

    const items = await pool.query(`
      SELECT woi.*, p.nombre AS producto_nombre
      FROM wholesale_order_items woi
      LEFT JOIN products p ON p.id = woi.product_id
      WHERE woi.order_id = $1
    `, [req.params.id]);

    res.json({ ...order.rows[0], items: items.rows });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  const client = await pool.connect();
  try {
    const { client_id, items, notas, fecha_entrega } = req.body;
    if (!client_id) return res.status(400).json({ error: 'El cliente es requerido' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });

    const clientCheck = await client.query(
      'SELECT id FROM wholesale_clients WHERE id=$1 AND activo=TRUE', [client_id]
    );
    if (!clientCheck.rows[0]) return res.status(400).json({ error: 'Cliente no encontrado' });

    await client.query('BEGIN');

    let total = 0;
    const validatedItems = [];
    for (const item of items) {
      const subtotal = parseFloat(item.precio_unitario) * parseFloat(item.cantidad);
      total += subtotal;
      validatedItems.push({ ...item, subtotal });
    }

    const orderResult = await client.query(
      `INSERT INTO wholesale_orders (client_id, user_id, total, notas, fecha_entrega)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [client_id, req.user.id, total, notas || null, fecha_entrega || null]
    );
    const order = orderResult.rows[0];

    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO wholesale_order_items (order_id, product_id, descripcion, cantidad, precio_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, item.product_id || null, item.descripcion || null, item.cantidad, item.precio_unitario, item.subtotal]
      );
    }

    await client.query('COMMIT');

    const full = await pool.query(`
      SELECT wo.*, c.nombre AS client_nombre, u.nombre AS user_nombre
      FROM wholesale_orders wo
      JOIN wholesale_clients c ON c.id=wo.client_id
      JOIN users u ON u.id=wo.user_id
      WHERE wo.id=$1
    `, [order.id]);
    const fullItems = await pool.query(`
      SELECT woi.*, p.nombre AS producto_nombre
      FROM wholesale_order_items woi
      LEFT JOIN products p ON p.id=woi.product_id
      WHERE woi.order_id=$1
    `, [order.id]);

    res.status(201).json({ ...full.rows[0], items: fullItems.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function updateEstado(req, res, next) {
  try {
    const { estado } = req.body;
    if (!['pendiente', 'entregado', 'cancelado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const result = await pool.query(
      'UPDATE wholesale_orders SET estado=$1 WHERE id=$2 RETURNING *',
      [estado, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, updateEstado };
