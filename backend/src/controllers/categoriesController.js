const pool = require('../db/pool');

async function getAll(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY nombre');
    res.json(result.rows);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = await pool.query(
      'INSERT INTO categories (nombre, descripcion) VALUES ($1,$2) RETURNING *',
      [nombre, descripcion || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { nombre, descripcion } = req.body;
    const result = await pool.query(
      'UPDATE categories SET nombre=COALESCE($1,nombre), descripcion=COALESCE($2,descripcion) WHERE id=$3 RETURNING *',
      [nombre, descripcion, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const result = await pool.query('DELETE FROM categories WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ message: 'Categoría eliminada correctamente' });
  } catch (err) { next(err); }
}

module.exports = { getAll, create, update, remove };
