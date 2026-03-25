const pool = require('../db/pool');

async function getAll(req, res, next) {
  try {
    const { estado } = req.query;
    const params = [];
    const conditions = [];

    if (req.user.role === 'local') {
      params.push(req.user.local_id);
      conditions.push(`fo.local_id = $${params.length}`);
    }
    if (estado) {
      params.push(estado);
      conditions.push(`fo.estado = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await pool.query(
      `SELECT fo.*, l.nombre as local_nombre, u.nombre as user_nombre
       FROM factory_orders fo
       JOIN locals l ON l.id = fo.local_id
       JOIN users u ON u.id = fo.user_id
       ${where}
       ORDER BY fo.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const order = await pool.query(
      `SELECT fo.*, l.nombre as local_nombre, u.nombre as user_nombre
       FROM factory_orders fo
       JOIN locals l ON l.id = fo.local_id
       JOIN users u ON u.id = fo.user_id
       WHERE fo.id = $1`,
      [req.params.id]
    );
    if (!order.rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (req.user.role === 'local' && order.rows[0].local_id !== req.user.local_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const items = await pool.query(
      `SELECT foi.*, p.nombre as producto_nombre
       FROM factory_order_items foi
       JOIN products p ON p.id = foi.product_id
       WHERE foi.order_id = $1`,
      [req.params.id]
    );
    res.json({ ...order.rows[0], items: items.rows });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  const client = await pool.connect();
  try {
    const { items, notas } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });
    }

    const local_id = req.user.local_id;
    if (!local_id) return res.status(400).json({ error: 'El usuario no tiene local asignado' });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fecha_entrega = tomorrow.toISOString().split('T')[0];

    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO factory_orders (local_id, user_id, fecha_entrega, notas)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [local_id, req.user.id, fecha_entrega, notas || null]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      const prod = await client.query('SELECT id FROM products WHERE id=$1 AND activo=TRUE', [item.product_id]);
      if (!prod.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Producto ${item.product_id} no encontrado` });
      }
      await client.query(
        'INSERT INTO factory_order_items (order_id, product_id, cantidad) VALUES ($1,$2,$3)',
        [order.id, item.product_id, item.cantidad]
      );
    }

    await client.query('COMMIT');

    const full = await pool.query(
      `SELECT fo.*, l.nombre as local_nombre, u.nombre as user_nombre
       FROM factory_orders fo
       JOIN locals l ON l.id=fo.local_id
       JOIN users u ON u.id=fo.user_id
       WHERE fo.id=$1`,
      [order.id]
    );
    const fullItems = await pool.query(
      `SELECT foi.*, p.nombre as producto_nombre
       FROM factory_order_items foi JOIN products p ON p.id=foi.product_id
       WHERE foi.order_id=$1`,
      [order.id]
    );
    res.status(201).json({ ...full.rows[0], items: fullItems.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function complete(req, res, next) {
  try {
    const order = await pool.query('SELECT * FROM factory_orders WHERE id=$1', [req.params.id]);
    if (!order.rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (order.rows[0].estado === 'completado') {
      return res.status(400).json({ error: 'El pedido ya está completado' });
    }
    const result = await pool.query(
      "UPDATE factory_orders SET estado='completado' WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, complete };
