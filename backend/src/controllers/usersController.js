const bcrypt = require('bcrypt');
const pool = require('../db/pool');

async function getAll(req, res, next) {
  try {
    const { page = 1, limit = 20, local_id } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = '';
    if (local_id) { params.push(local_id); where = `WHERE u.local_id = $${params.length}`; }
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.role, u.local_id, u.activo, u.created_at,
              l.nombre as local_nombre
       FROM users u LEFT JOIN locals l ON l.id = u.local_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const countParams = local_id ? [local_id] : [];
    const countQ = local_id ? 'SELECT COUNT(*) FROM users WHERE local_id = $1' : 'SELECT COUNT(*) FROM users';
    const count = await pool.query(countQ, countParams);
    res.json({ data: result.rows, total: parseInt(count.rows[0].count), page: parseInt(page) });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.role, u.local_id, u.activo, u.created_at,
              l.nombre as local_nombre
       FROM users u LEFT JOIN locals l ON l.id = u.local_id WHERE u.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { nombre, email, password, role, local_id } = req.body;
    if (!nombre || !email || !password || !role) {
      return res.status(400).json({ error: 'nombre, email, password y role son requeridos' });
    }
    if (role === 'local' && !local_id) {
      return res.status(400).json({ error: 'local_id es requerido para usuarios de tipo local' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (nombre, email, password_hash, role, local_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre, email, role, local_id, activo, created_at',
      [nombre, email.toLowerCase(), hash, role, local_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya está en uso' });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { nombre, email, password, role, local_id, activo } = req.body;
    const hash = password ? await bcrypt.hash(password, 10) : null;
    const result = await pool.query(
      `UPDATE users SET
        nombre = COALESCE($1, nombre),
        email = COALESCE($2, email),
        password_hash = COALESCE($3, password_hash),
        role = COALESCE($4, role),
        local_id = COALESCE($5, local_id),
        activo = COALESCE($6, activo)
      WHERE id = $7
      RETURNING id, nombre, email, role, local_id, activo, created_at`,
      [nombre, email, hash, role, local_id, activo, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya está en uso' });
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await pool.query(
      'UPDATE users SET activo = FALSE WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Usuario desactivado correctamente' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove };
