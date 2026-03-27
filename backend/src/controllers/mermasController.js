const pool = require('../db/pool');

async function getAll(req, res, next) {
  try {
    const local_id = req.user.role === 'admin' ? req.query.local_id : req.user.local_id;
    if (!local_id) return res.status(400).json({ error: 'local_id requerido' });

    const result = await pool.query(
      `SELECT m.*, u.nombre as user_nombre
       FROM mermas m JOIN users u ON u.id = m.user_id
       WHERE m.local_id = $1
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [local_id]
    );

    const mermasWithItems = await Promise.all(
      result.rows.map(async (m) => {
        const items = await pool.query(
          `SELECT mi.*, p.nombre as producto_nombre
           FROM merma_items mi JOIN products p ON p.id = mi.product_id
           WHERE mi.merma_id = $1`,
          [m.id]
        );
        return { ...m, items: items.rows };
      })
    );

    res.json(mermasWithItems);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  const client = await pool.connect();
  try {
    const { items, motivo, notas } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un producto' });
    }

    const local_id = req.user.local_id;
    if (!local_id) return res.status(400).json({ error: 'El usuario no tiene local asignado' });

    await client.query('BEGIN');

    const mermaResult = await client.query(
      `INSERT INTO mermas (local_id, user_id, motivo, notas)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [local_id, req.user.id, motivo || 'Desperfecto', notas || null]
    );
    const merma = mermaResult.rows[0];

    for (const item of items) {
      const prod = await client.query('SELECT id FROM products WHERE id=$1 AND activo=TRUE', [item.product_id]);
      if (!prod.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Producto ${item.product_id} no encontrado` });
      }
      await client.query(
        'INSERT INTO merma_items (merma_id, product_id, cantidad) VALUES ($1,$2,$3)',
        [merma.id, item.product_id, item.cantidad]
      );
    }

    await client.query('COMMIT');

    const items_result = await pool.query(
      `SELECT mi.*, p.nombre as producto_nombre
       FROM merma_items mi JOIN products p ON p.id = mi.product_id
       WHERE mi.merma_id = $1`,
      [merma.id]
    );

    res.status(201).json({ ...merma, items: items_result.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { getAll, create };
