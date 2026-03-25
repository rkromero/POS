const pool = require('../db/pool');

async function getAll(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      pool.query('SELECT * FROM locals ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM locals'),
    ]);
    res.json({ data: rows.rows, total: parseInt(count.rows[0].count), page: parseInt(page) });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM locals WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Local no encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { nombre, direccion, telefono, logo_url } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = await pool.query(
      'INSERT INTO locals (nombre, direccion, telefono, logo_url) VALUES ($1,$2,$3,$4) RETURNING *',
      [nombre, direccion || null, telefono || null, logo_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { nombre, direccion, telefono, logo_url, activo } = req.body;
    const result = await pool.query(
      `UPDATE locals SET
        nombre = COALESCE($1, nombre),
        direccion = COALESCE($2, direccion),
        telefono = COALESCE($3, telefono),
        logo_url = COALESCE($4, logo_url),
        activo = COALESCE($5, activo)
      WHERE id = $6 RETURNING *`,
      [nombre, direccion, telefono, logo_url, activo, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Local no encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const result = await pool.query('DELETE FROM locals WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Local no encontrado' });
    res.json({ message: 'Local eliminado correctamente' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove };
