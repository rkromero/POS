const pool = require('../db/pool');

async function getAll(req, res, next) {
  try {
    const { page = 1, limit = 20, desde, hasta, local_id } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    const effectiveLocalId = req.user.role === 'local' ? req.user.local_id : local_id;
    if (effectiveLocalId) { params.push(effectiveLocalId); conditions.push(`s.local_id = $${params.length}`); }
    if (desde) { params.push(desde); conditions.push(`s.created_at >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conditions.push(`s.created_at < ($${params.length}::date + interval '1 day')`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const filterParams = [...params];
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT s.*, l.nombre as local_nombre, u.nombre as user_nombre
       FROM sales s JOIN locals l ON l.id=s.local_id JOIN users u ON u.id=s.user_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await pool.query(`SELECT COUNT(*) FROM sales s ${where}`, filterParams);
    res.json({ data: result.rows, total: parseInt(count.rows[0].count), page: parseInt(page) });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const sale = await pool.query(
      `SELECT s.*, l.nombre as local_nombre, l.logo_url as local_logo, u.nombre as user_nombre
       FROM sales s JOIN locals l ON l.id=s.local_id JOIN users u ON u.id=s.user_id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (!sale.rows[0]) return res.status(404).json({ error: 'Venta no encontrada' });
    if (req.user.role === 'local' && sale.rows[0].local_id !== req.user.local_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const items = await pool.query(
      `SELECT si.*, p.nombre as producto_nombre
       FROM sale_items si JOIN products p ON p.id=si.product_id WHERE si.sale_id=$1`,
      [req.params.id]
    );
    res.json({ ...sale.rows[0], items: items.rows });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  const client = await pool.connect();
  try {
    const { cliente_nombre, cliente_email, cliente_whatsapp, metodo_pago, items } = req.body;
    if (!cliente_nombre) return res.status(400).json({ error: 'El nombre del cliente es requerido' });
    if (!metodo_pago) return res.status(400).json({ error: 'El método de pago es requerido' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'La venta debe tener al menos un producto' });

    const local_id = req.user.role === 'local' ? req.user.local_id : req.body.local_id;
    if (!local_id) return res.status(400).json({ error: 'local_id es requerido' });

    await client.query('BEGIN');

    let total = 0;
    const validatedItems = [];
    for (const item of items) {
      const prod = await client.query(
        'SELECT id, precio, stock FROM products WHERE id=$1 AND activo=TRUE FOR UPDATE',
        [item.product_id]
      );
      if (!prod.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Producto ${item.product_id} no encontrado o inactivo` });
      }
      if (prod.rows[0].stock < item.cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Stock insuficiente para el producto ${item.product_id}` });
      }
      const subtotal = parseFloat(prod.rows[0].precio) * item.cantidad;
      total += subtotal;
      validatedItems.push({ ...item, precio_unitario: prod.rows[0].precio, subtotal });
    }

    const saleResult = await client.query(
      `INSERT INTO sales (local_id, user_id, cliente_nombre, cliente_email, cliente_whatsapp, metodo_pago, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [local_id, req.user.id, cliente_nombre, cliente_email || null, cliente_whatsapp || null, metodo_pago, total]
    );
    const sale = saleResult.rows[0];

    for (const item of validatedItems) {
      await client.query(
        'INSERT INTO sale_items (sale_id, product_id, cantidad, precio_unitario, subtotal) VALUES ($1,$2,$3,$4,$5)',
        [sale.id, item.product_id, item.cantidad, item.precio_unitario, item.subtotal]
      );
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.cantidad, item.product_id]);
    }

    await client.query('COMMIT');

    const fullSale = await pool.query(
      `SELECT s.*, l.nombre as local_nombre, l.logo_url as local_logo
       FROM sales s JOIN locals l ON l.id=s.local_id WHERE s.id=$1`,
      [sale.id]
    );
    const saleItems = await pool.query(
      `SELECT si.*, p.nombre as producto_nombre FROM sale_items si JOIN products p ON p.id=si.product_id WHERE si.sale_id=$1`,
      [sale.id]
    );
    res.status(201).json({ ...fullSale.rows[0], items: saleItems.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { getAll, getById, create };
