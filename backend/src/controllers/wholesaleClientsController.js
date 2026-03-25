const pool = require('../db/pool');

async function getAll(req, res, next) {
  try {
    const { search } = req.query;
    const params = [];
    let where = 'WHERE c.activo = TRUE';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (c.nombre ILIKE $${params.length} OR c.telefono ILIKE $${params.length} OR c.email ILIKE $${params.length})`;
    }

    const result = await pool.query(`
      SELECT c.*,
        COALESCE(SUM(CASE WHEN wo.estado != 'cancelado' THEN wo.total ELSE 0 END), 0) AS total_ventas,
        COALESCE((SELECT SUM(wp.monto) FROM wholesale_payments wp WHERE wp.client_id = c.id), 0) AS total_pagado,
        COALESCE(SUM(CASE WHEN wo.estado != 'cancelado' THEN wo.total ELSE 0 END), 0) -
        COALESCE((SELECT SUM(wp.monto) FROM wholesale_payments wp WHERE wp.client_id = c.id), 0) AS saldo
      FROM wholesale_clients c
      LEFT JOIN wholesale_orders wo ON wo.client_id = c.id
      ${where}
      GROUP BY c.id
      ORDER BY c.nombre
    `, params);

    res.json(result.rows);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const client = await pool.query(
      'SELECT * FROM wholesale_clients WHERE id = $1 AND activo = TRUE',
      [req.params.id]
    );
    if (!client.rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });

    const orders = await pool.query(`
      SELECT wo.*, u.nombre AS user_nombre
      FROM wholesale_orders wo
      JOIN users u ON u.id = wo.user_id
      WHERE wo.client_id = $1
      ORDER BY wo.created_at DESC
    `, [req.params.id]);

    const payments = await pool.query(`
      SELECT wp.*, u.nombre AS user_nombre
      FROM wholesale_payments wp
      JOIN users u ON u.id = wp.user_id
      WHERE wp.client_id = $1
      ORDER BY wp.created_at DESC
    `, [req.params.id]);

    const totals = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN estado != 'cancelado' THEN total ELSE 0 END), 0) AS total_ventas
      FROM wholesale_orders WHERE client_id = $1
    `, [req.params.id]);

    const pagado = await pool.query(`
      SELECT COALESCE(SUM(monto), 0) AS total_pagado
      FROM wholesale_payments WHERE client_id = $1
    `, [req.params.id]);

    const totalVentas = parseFloat(totals.rows[0].total_ventas);
    const totalPagado = parseFloat(pagado.rows[0].total_pagado);

    res.json({
      ...client.rows[0],
      total_ventas: totalVentas,
      total_pagado: totalPagado,
      saldo: totalVentas - totalPagado,
      orders: orders.rows,
      payments: payments.rows,
    });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { nombre, telefono, email, direccion, notas } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = await pool.query(
      'INSERT INTO wholesale_clients (nombre, telefono, email, direccion, notas) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [nombre, telefono || null, email || null, direccion || null, notas || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { nombre, telefono, email, direccion, notas } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = await pool.query(
      `UPDATE wholesale_clients
       SET nombre=$1, telefono=$2, email=$3, direccion=$4, notas=$5
       WHERE id=$6 AND activo=TRUE RETURNING *`,
      [nombre, telefono || null, email || null, direccion || null, notas || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update };
