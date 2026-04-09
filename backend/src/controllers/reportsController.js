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
    const { local_id, limit = 10, desde, hasta, unidad_medida } = req.query;
    const effectiveLocalId = req.user.role === 'local' ? req.user.local_id : local_id;
    const params = [];
    const conditions = [];

    if (effectiveLocalId) { params.push(effectiveLocalId); conditions.push(`s.local_id = $${params.length}`); }
    if (desde) { params.push(desde); conditions.push(`s.created_at >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conditions.push(`s.created_at < ($${params.length}::date + interval '1 day')`); }
    if (unidad_medida === 'kg') { conditions.push(`p.unidad_medida = 'kg'`); }
    else if (unidad_medida === 'unidad') { conditions.push(`p.unidad_medida != 'kg'`); }
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

async function byCashier(req, res, next) {
  try {
    const { desde, hasta, local_id, user_id } = req.query;
    const params = [];
    const conditions = [];

    if (local_id) { params.push(local_id); conditions.push(`s.local_id = $${params.length}`); }
    if (user_id) { params.push(user_id); conditions.push(`s.user_id = $${params.length}`); }
    if (desde) { params.push(desde); conditions.push(`s.created_at >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conditions.push(`s.created_at < ($${params.length}::date + interval '1 day')`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await pool.query(
      `SELECT u.id, u.nombre, l.nombre as local_nombre,
              COUNT(s.id) as total_ventas, COALESCE(SUM(s.total),0) as monto_total
       FROM sales s
       JOIN users u ON u.id = s.user_id
       JOIN locals l ON l.id = s.local_id
       ${where}
       GROUP BY u.id, u.nombre, l.nombre
       ORDER BY monto_total DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
}

async function dailyResult(req, res, next) {
  try {
    const { desde, hasta, local_id } = req.query;
    const start = desde || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const end = hasta || new Date().toISOString().split('T')[0];
    const params = [start, end];

    const salesCond = local_id ? (params.push(local_id), `AND local_id = $${params.length}`) : '';
    const gastosCond = local_id ? `AND local_id = $${params.length}` : '';
    const mermaCond = local_id ? `AND m.local_id = $${params.length}` : '';

    const result = await pool.query(`
      WITH dias AS (
        SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS dia
      ),
      ventas AS (
        SELECT created_at::date AS dia, COALESCE(SUM(total), 0) AS total_ventas
        FROM sales
        WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
        ${salesCond}
        GROUP BY created_at::date
      ),
      gastos_agg AS (
        SELECT fecha AS dia, COALESCE(SUM(monto), 0) AS total_gastos
        FROM gastos
        WHERE fecha >= $1::date AND fecha <= $2::date
        ${gastosCond}
        GROUP BY fecha
      ),
      merma_agg AS (
        SELECT m.created_at::date AS dia,
               COALESCE(SUM(mi.cantidad * p.precio), 0) AS total_merma
        FROM mermas m
        JOIN merma_items mi ON mi.merma_id = m.id
        JOIN products p ON p.id = mi.product_id
        WHERE m.created_at >= $1::date AND m.created_at < ($2::date + interval '1 day')
        ${mermaCond}
        GROUP BY m.created_at::date
      )
      SELECT
        d.dia,
        COALESCE(v.total_ventas, 0)  AS total_ventas,
        COALESCE(g.total_gastos, 0)  AS total_gastos,
        COALESCE(me.total_merma, 0)  AS total_merma,
        COALESCE(v.total_ventas, 0) - COALESCE(g.total_gastos, 0) - COALESCE(me.total_merma, 0) AS resultado
      FROM dias d
      LEFT JOIN ventas      v  ON v.dia  = d.dia
      LEFT JOIN gastos_agg  g  ON g.dia  = d.dia
      LEFT JOIN merma_agg   me ON me.dia = d.dia
      ORDER BY d.dia ASC
    `, params);

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

module.exports = { salesByLocal, salesByPeriod, topProducts, byCashier, dailyResult, comparisonByLocal };
