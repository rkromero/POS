const pool = require('../db/pool');

async function salesByLocal(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT l.id, l.nombre, COUNT(s.id) as total_ventas, COALESCE(SUM(s.total),0) as monto_total
       FROM locals l LEFT JOIN sales s ON s.local_id = l.id
       GROUP BY l.id, l.nombre ORDER BY monto_total DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
}

async function salesByPeriod(req, res, next) {
  try {
    const { desde, hasta, local_id, period = 'day' } = req.query;
    const effectiveLocalId = req.user.role === 'local' ? req.user.local_id : local_id;
    const params = [];
    const conditions = [];

    if (effectiveLocalId) { params.push(effectiveLocalId); conditions.push(`s.local_id = $${params.length}`); }
    if (desde) { params.push(desde); conditions.push(`s.created_at >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conditions.push(`s.created_at < ($${params.length}::date + interval '1 day')`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const truncMap = { day: 'day', week: 'week', month: 'month' };
    const trunc = truncMap[period] || 'day';

    const result = await pool.query(
      `SELECT DATE_TRUNC('${trunc}', s.created_at) as periodo,
              COUNT(s.id) as total_ventas, COALESCE(SUM(s.total),0) as monto_total
       FROM sales s ${where}
       GROUP BY periodo ORDER BY periodo ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
}

async function topProducts(req, res, next) {
  try {
    const { local_id, limit = 10, desde, hasta } = req.query;
    const effectiveLocalId = req.user.role === 'local' ? req.user.local_id : local_id;
    const params = [];
    const conditions = [];

    if (effectiveLocalId) { params.push(effectiveLocalId); conditions.push(`s.local_id = $${params.length}`); }
    if (desde) { params.push(desde); conditions.push(`s.created_at >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conditions.push(`s.created_at < ($${params.length}::date + interval '1 day')`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(limit);

    const result = await pool.query(
      `SELECT p.id, p.nombre, p.unidad_medida, SUM(si.cantidad) as total_cantidad, SUM(si.subtotal) as total_monto
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       JOIN sales s ON s.id = si.sale_id
       ${where}
       GROUP BY p.id, p.nombre, p.unidad_medida
       ORDER BY total_cantidad DESC
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
}

async function comparisonByLocal(req, res, next) {
  try {
    const { desde, hasta } = req.query;
    const params = [];
    const conditions = [];
    if (desde) { params.push(desde); conditions.push(`s.created_at >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conditions.push(`s.created_at < ($${params.length}::date + interval '1 day')`); }
    const saleFilter = conditions.length ? 'AND ' + conditions.join(' AND ') : '';

    const result = await pool.query(
      `SELECT l.id, l.nombre, COUNT(s.id) as total_ventas, COALESCE(SUM(s.total),0) as monto_total
       FROM locals l LEFT JOIN sales s ON s.local_id = l.id ${saleFilter}
       GROUP BY l.id, l.nombre ORDER BY monto_total DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
}

module.exports = { salesByLocal, salesByPeriod, topProducts, comparisonByLocal };
