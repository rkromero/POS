const pool = require('../db/pool');

async function getAll(req, res, next) {
  try {
    const { page = 1, limit = 20, categoria_id, search, activo } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (categoria_id) { params.push(categoria_id); conditions.push(`p.categoria_id = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`p.nombre ILIKE $${params.length}`); }
    if (activo !== undefined) { params.push(activo === 'true'); conditions.push(`p.activo = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const filterParams = [...params];
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT p.*, c.nombre as categoria_nombre
       FROM products p LEFT JOIN categories c ON c.id = p.categoria_id
       ${where}
       ORDER BY p.nombre
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await pool.query(`SELECT COUNT(*) FROM products p ${where}`, filterParams);
    res.json({ data: result.rows, total: parseInt(count.rows[0].count), page: parseInt(page) });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT p.*, c.nombre as categoria_nombre FROM products p LEFT JOIN categories c ON c.id=p.categoria_id WHERE p.id=$1',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { nombre, descripcion, precio, categoria_id, stock } = req.body;
    if (!nombre || precio === undefined) {
      return res.status(400).json({ error: 'nombre y precio son requeridos' });
    }
    const result = await pool.query(
      'INSERT INTO products (nombre, descripcion, precio, categoria_id, stock) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [nombre, descripcion || null, precio, categoria_id || null, stock || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { nombre, descripcion, precio, categoria_id, stock, activo } = req.body;
    const isAdmin = req.user?.role === 'admin';
    let result;

    if (!isAdmin) {
      // Usuarios de local solo pueden editar precio y stock
      result = await pool.query(
        'UPDATE products SET precio=COALESCE($1,precio), stock=COALESCE($2,stock) WHERE id=$3 RETURNING *',
        [precio, stock, req.params.id]
      );
    } else {
      result = await pool.query(
        `UPDATE products SET
          nombre=COALESCE($1,nombre), descripcion=COALESCE($2,descripcion),
          precio=COALESCE($3,precio), categoria_id=$4,
          stock=COALESCE($5,stock), activo=COALESCE($6,activo)
        WHERE id=$7 RETURNING *`,
        [nombre, descripcion, precio, categoria_id || null, stock, activo, req.params.id]
      );
    }
    if (!result.rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const result = await pool.query(
      'UPDATE products SET activo = FALSE WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto desactivado correctamente' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove };
