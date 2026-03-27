const pool = require('../db/pool');

async function getAll(req, res, next) {
  try {
    const local_id = req.user.role === 'admin' ? req.query.local_id : req.user.local_id;
    if (!local_id) return res.status(400).json({ error: 'local_id requerido' });

    const fecha = req.query.fecha || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT g.*, u.nombre as user_nombre
       FROM gastos g JOIN users u ON u.id = g.user_id
       WHERE g.local_id = $1
         AND g.fecha = $2
       ORDER BY g.created_at DESC`,
      [local_id, fecha]
    );

    const totales = await pool.query(
      `SELECT
        COALESCE(SUM(monto), 0) as total,
        COALESCE(SUM(CASE WHEN abonado_con='Efectivo Caja' THEN monto ELSE 0 END), 0) as total_efectivo,
        COALESCE(SUM(CASE WHEN abonado_con='Transferencia' THEN monto ELSE 0 END), 0) as total_transferencia
       FROM gastos
       WHERE local_id = $1 AND fecha = $2`,
      [local_id, fecha]
    );

    res.json({ gastos: result.rows, ...totales.rows[0] });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const local_id = req.user.local_id;
    if (!local_id) return res.status(400).json({ error: 'El usuario no tiene local asignado' });

    const { tipo, descripcion, monto, abonado_con, fecha } = req.body;
    if (!tipo) return res.status(400).json({ error: 'tipo es requerido' });
    if (!monto || parseFloat(monto) <= 0) return res.status(400).json({ error: 'monto inválido' });

    const targetFecha = fecha || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `INSERT INTO gastos (local_id, user_id, tipo, descripcion, monto, abonado_con, fecha)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [local_id, req.user.id, tipo, descripcion || null, parseFloat(monto),
       abonado_con || 'Efectivo Caja', targetFecha]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const local_id = req.user.local_id;
    const { id } = req.params;

    const existing = await pool.query(
      'SELECT id FROM gastos WHERE id=$1 AND local_id=$2',
      [id, local_id]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Gasto no encontrado' });

    await pool.query('DELETE FROM gastos WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { getAll, create, remove };
