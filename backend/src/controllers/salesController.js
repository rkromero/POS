const pool = require('../db/pool');
const { awardPoints } = require('../services/loyaltyService');
const { createSaleTx, getFullSale, localTieneCajero } = require('../services/salesService');

async function getAll(req, res, next) {
  try {
    const { page = 1, limit = 20, desde, hasta, local_id } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    const effectiveLocalId = req.user.role === 'admin' ? local_id : req.user.local_id;
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
    if (req.user.role !== 'admin' && sale.rows[0].local_id !== req.user.local_id) {
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
    const local_id = req.user.role === 'admin' ? req.body.local_id : req.user.local_id;

    // Si el local tiene cajero, el usuario del local no cobra: envía el pedido a caja
    if (req.user.role === 'local' && await localTieneCajero(local_id)) {
      return res.status(403).json({ error: 'Este local tiene cajero: enviá el pedido a caja para cobrarlo' });
    }

    await client.query('BEGIN');
    const saleId = await createSaleTx(client, {
      local_id, user_id: req.user.id, metodo_pago, items, cliente_nombre, cliente_email, cliente_whatsapp,
    });
    await client.query('COMMIT');

    const saleData = await getFullSale(saleId);

    // Otorgar puntos de fidelización (no bloquea la respuesta)
    awardPoints(saleData);

    res.status(201).json(saleData);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { getAll, getById, create };
