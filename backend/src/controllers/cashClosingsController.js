const pool = require('../db/pool');

async function getDaySummary(req, res, next) {
  try {
    const fecha = req.query.fecha || new Date().toISOString().split('T')[0];
    const isAdmin = req.user.role === 'admin';
    const local_id = isAdmin ? req.query.local_id : req.user.local_id;
    if (!local_id) return res.status(400).json({ error: 'local_id requerido' });

    if (!isAdmin) {
      // Cajera: solo verifica si ya cerró su propio turno este día
      const closing = await pool.query(
        'SELECT * FROM cash_closings WHERE local_id=$1 AND fecha=$2 AND user_id=$3',
        [local_id, fecha, req.user.id]
      );
      return res.json({ fecha, closing: closing.rows[0] || null });
    }

    // Admin: resumen completo del día
    const params = [local_id, fecha];
    const totals = await pool.query(
      `SELECT
        COUNT(*) as total_ventas,
        COALESCE(SUM(total), 0) as monto_total,
        COALESCE(SUM(CASE WHEN metodo_pago='efectivo' THEN total ELSE 0 END), 0) as monto_efectivo,
        COALESCE(SUM(CASE WHEN metodo_pago='debito' THEN total ELSE 0 END), 0) as monto_debito,
        COALESCE(SUM(CASE WHEN metodo_pago='credito' THEN total ELSE 0 END), 0) as monto_credito,
        COALESCE(SUM(CASE WHEN metodo_pago='transferencia' THEN total ELSE 0 END), 0) as monto_transferencia
       FROM sales
       WHERE local_id = $1
         AND created_at >= $2::date
         AND created_at < ($2::date + interval '1 day')`,
      params
    );
    const sales = await pool.query(
      `SELECT s.id, s.numero_comprobante, s.cliente_nombre, s.metodo_pago, s.total, s.created_at,
              u.nombre as user_nombre
       FROM sales s JOIN users u ON u.id = s.user_id
       WHERE s.local_id = $1
         AND s.created_at >= $2::date
         AND s.created_at < ($2::date + interval '1 day')
       ORDER BY s.created_at ASC`,
      params
    );
    const closings = await pool.query(
      `SELECT cc.*, u.nombre as user_nombre
       FROM cash_closings cc JOIN users u ON u.id = cc.user_id
       WHERE cc.local_id=$1 AND cc.fecha=$2
       ORDER BY cc.created_at ASC`,
      [local_id, fecha]
    );
    res.json({
      fecha,
      ...totals.rows[0],
      sales: sales.rows,
      closings: closings.rows,
    });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { fecha, notas, declarado_efectivo, declarado_debito, declarado_credito, declarado_transferencia } = req.body;
    const local_id = req.user.local_id;
    if (!local_id) return res.status(400).json({ error: 'El usuario no tiene local asignado' });

    const targetDate = fecha || new Date().toISOString().split('T')[0];

    const existing = await pool.query(
      'SELECT id FROM cash_closings WHERE local_id=$1 AND fecha=$2 AND user_id=$3',
      [local_id, targetDate, req.user.id]
    );
    if (existing.rows[0]) {
      return res.status(400).json({ error: 'Ya registraste un cierre para este día' });
    }

    // Calcular totales del sistema para las ventas de esta cajera en el turno
    const totals = await pool.query(
      `SELECT
        COUNT(*) as total_ventas,
        COALESCE(SUM(total), 0) as monto_total,
        COALESCE(SUM(CASE WHEN metodo_pago='efectivo' THEN total ELSE 0 END), 0) as monto_efectivo,
        COALESCE(SUM(CASE WHEN metodo_pago='debito' THEN total ELSE 0 END), 0) as monto_debito,
        COALESCE(SUM(CASE WHEN metodo_pago='credito' THEN total ELSE 0 END), 0) as monto_credito,
        COALESCE(SUM(CASE WHEN metodo_pago='transferencia' THEN total ELSE 0 END), 0) as monto_transferencia
       FROM sales
       WHERE local_id=$1 AND user_id=$2
         AND created_at >= $3::date
         AND created_at < ($3::date + interval '1 day')`,
      [local_id, req.user.id, targetDate]
    );

    const t = totals.rows[0];
    const decEfectivo = parseFloat(declarado_efectivo) || 0;
    const decDebito = parseFloat(declarado_debito) || 0;
    const decCredito = parseFloat(declarado_credito) || 0;
    const decTransferencia = parseFloat(declarado_transferencia) || 0;
    const decTotal = decEfectivo + decDebito + decCredito + decTransferencia;

    const result = await pool.query(
      `INSERT INTO cash_closings
        (local_id, user_id, fecha, total_ventas, monto_efectivo, monto_debito, monto_credito, monto_transferencia, monto_total,
         declarado_efectivo, declarado_debito, declarado_credito, declarado_transferencia, declarado_total, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [local_id, req.user.id, targetDate,
       t.total_ventas, t.monto_efectivo, t.monto_debito, t.monto_credito, t.monto_transferencia, t.monto_total,
       decEfectivo, decDebito, decCredito, decTransferencia, decTotal, notas || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

async function getAll(req, res, next) {
  try {
    const isAdmin = req.user.role === 'admin';
    const local_id = isAdmin ? req.query.local_id : req.user.local_id;
    const params = [];
    const conditions = [];

    if (local_id) { params.push(local_id); conditions.push(`cc.local_id = $${params.length}`); }
    if (!isAdmin) { params.push(req.user.id); conditions.push(`cc.user_id = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await pool.query(
      `SELECT cc.*, l.nombre as local_nombre, u.nombre as user_nombre
       FROM cash_closings cc
       JOIN locals l ON l.id = cc.local_id
       JOIN users u ON u.id = cc.user_id
       ${where}
       ORDER BY cc.fecha DESC, cc.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
}

async function getConsolidated(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso restringido a administradores' });
    }

    const today = new Date().toISOString().split('T')[0];
    const desde = req.query.desde || today;
    const hasta = req.query.hasta || today;
    const local_id = req.query.local_id || null;

    const params = [desde, hasta];
    const localFilter = local_id ? `AND cc.local_id = $${params.push(local_id)}` : '';

    const consolidatedResult = await pool.query(
      `SELECT
        l.id as local_id,
        l.nombre as local_nombre,
        cc.fecha,
        COUNT(DISTINCT cc.user_id) as num_cajeros,
        COUNT(cc.id) as num_cierres,
        COALESCE(SUM(cc.declarado_total), 0) as total_cajeros,
        COALESCE((
          SELECT SUM(s.total) FROM sales s
          WHERE s.local_id = l.id
            AND s.created_at >= cc.fecha::date
            AND s.created_at < (cc.fecha::date + interval '1 day')
        ), 0) as total_pos
      FROM cash_closings cc
      JOIN locals l ON l.id = cc.local_id
      WHERE cc.fecha BETWEEN $1 AND $2
        ${localFilter}
      GROUP BY l.id, l.nombre, cc.fecha
      ORDER BY cc.fecha DESC, l.nombre ASC`,
      params
    );

    const rows = consolidatedResult.rows;
    if (rows.length === 0) return res.json([]);

    // Helper: normaliza fecha sin importar si pg la devuelve como string o Date
    const toDateStr = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

    // Bulk fetch con los mismos filtros — evita construcción de pares con fechas
    const detailsResult = await pool.query(
      `SELECT cc.id, cc.user_id, u.nombre as user_nombre,
              cc.local_id, cc.fecha,
              cc.declarado_total, cc.monto_total, cc.total_ventas,
              cc.declarado_efectivo, cc.declarado_debito, cc.declarado_credito, cc.declarado_transferencia,
              cc.notas, cc.created_at
       FROM cash_closings cc
       JOIN users u ON u.id = cc.user_id
       WHERE cc.fecha BETWEEN $1 AND $2
         ${localFilter}
       ORDER BY cc.fecha DESC, cc.local_id ASC, cc.created_at ASC`,
      params
    );

    // Map details to their parent consolidated row
    const detailMap = {};
    for (const d of detailsResult.rows) {
      const key = `${toDateStr(d.fecha)}-${d.local_id}`;
      if (!detailMap[key]) detailMap[key] = [];
      detailMap[key].push(d);
    }

    const response = rows.map(r => {
      const key = `${toDateStr(r.fecha)}-${r.local_id}`;
      const totalCajeros = parseFloat(r.total_cajeros) || 0;
      const totalPos = parseFloat(r.total_pos) || 0;
      return {
        local_id: r.local_id,
        local_nombre: r.local_nombre,
        fecha: r.fecha,
        num_cajeros: parseInt(r.num_cajeros, 10),
        num_cierres: parseInt(r.num_cierres, 10),
        total_cajeros: totalCajeros,
        total_pos: totalPos,
        diferencia: totalCajeros - totalPos,
        cajeros: detailMap[key] || [],
      };
    });

    res.json(response);
  } catch (err) { next(err); }
}

module.exports = { getDaySummary, create, getAll, getConsolidated };
