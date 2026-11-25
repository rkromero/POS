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

// Punto de venta ARCA: null/'' => sin punto de venta; si no, entero 1..99999.
// Devuelve { valor } o { error }.
function parsePuntoVenta(v) {
  if (v === null || v === '') return { valor: null };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 99999) {
    return { error: 'Punto de venta ARCA inválido (entero entre 1 y 99999)' };
  }
  return { valor: n };
}

async function create(req, res, next) {
  try {
    const { nombre, direccion, telefono, logo_url, arca_punto_venta } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const pv = arca_punto_venta === undefined ? { valor: null } : parsePuntoVenta(arca_punto_venta);
    if (pv.error) return res.status(400).json({ error: pv.error });
    const result = await pool.query(
      'INSERT INTO locals (nombre, direccion, telefono, logo_url, arca_punto_venta) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [nombre, direccion || null, telefono || null, logo_url || null, pv.valor]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { nombre, direccion, telefono, logo_url, activo, arca_punto_venta } = req.body;
    // Si arca_punto_venta no viene en el body, no se modifica; si viene null/'' se borra
    const cambiaPv = arca_punto_venta !== undefined;
    const pv = cambiaPv ? parsePuntoVenta(arca_punto_venta) : { valor: null };
    if (pv.error) return res.status(400).json({ error: pv.error });
    const result = await pool.query(
      `UPDATE locals SET
        nombre = COALESCE($1, nombre),
        direccion = COALESCE($2, direccion),
        telefono = COALESCE($3, telefono),
        logo_url = COALESCE($4, logo_url),
        activo = COALESCE($5, activo),
        arca_punto_venta = CASE WHEN $7::boolean THEN $8::integer ELSE arca_punto_venta END
      WHERE id = $6 RETURNING *`,
      [nombre, direccion, telefono, logo_url, activo, req.params.id, cambiaPv, pv.valor]
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
