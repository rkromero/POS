const pool = require('../db/pool');

async function getByClient(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT wp.*, u.nombre AS user_nombre
      FROM wholesale_payments wp
      JOIN users u ON u.id = wp.user_id
      WHERE wp.client_id = $1
      ORDER BY wp.created_at DESC
    `, [req.params.client_id]);
    res.json(result.rows);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { client_id, monto, notas } = req.body;
    if (!client_id) return res.status(400).json({ error: 'El cliente es requerido' });
    if (!monto || parseFloat(monto) <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

    const clientCheck = await pool.query(
      'SELECT id FROM wholesale_clients WHERE id=$1 AND activo=TRUE', [client_id]
    );
    if (!clientCheck.rows[0]) return res.status(400).json({ error: 'Cliente no encontrado' });

    const result = await pool.query(
      'INSERT INTO wholesale_payments (client_id, user_id, monto, notas) VALUES ($1,$2,$3,$4) RETURNING *',
      [client_id, req.user.id, parseFloat(monto), notas || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

module.exports = { getByClient, create };
