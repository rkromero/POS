const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { expireClientPoints } = require('../services/loyaltyService');

// GET /api/public/loyalty/cliente?q=phone_or_email
router.get('/cliente', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Ingresá tu teléfono o email' });
    }

    const term = q.trim();
    const r = await pool.query(
      'SELECT id, nombre, puntos_vigentes, nivel FROM loyalty_clients WHERE whatsapp=$1 OR email=$1',
      [term]
    );

    if (!r.rows[0]) {
      return res.status(404).json({ error: 'No encontramos una cuenta con ese teléfono o email.' });
    }

    // Expire stale points before returning balance
    await expireClientPoints(r.rows[0].id);

    const updated = await pool.query(
      'SELECT id, nombre, puntos_vigentes, nivel FROM loyalty_clients WHERE id=$1',
      [r.rows[0].id]
    );

    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

// GET /api/public/loyalty/beneficios
router.get('/beneficios', async (req, res, next) => {
  try {
    const r = await pool.query(
      'SELECT * FROM loyalty_beneficios WHERE activo=TRUE ORDER BY puntos_necesarios ASC'
    );
    res.json(r.rows);
  } catch (err) { next(err); }
});

// POST /api/public/loyalty/canje
router.post('/canje', async (req, res, next) => {
  try {
    const { client_id, beneficio_id } = req.body;
    if (!client_id || !beneficio_id) {
      return res.status(400).json({ error: 'client_id y beneficio_id son requeridos' });
    }

    await expireClientPoints(parseInt(client_id));

    const client = await pool.query(
      'SELECT * FROM loyalty_clients WHERE id=$1',
      [client_id]
    );
    if (!client.rows[0]) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const beneficio = await pool.query(
      'SELECT * FROM loyalty_beneficios WHERE id=$1 AND activo=TRUE',
      [beneficio_id]
    );
    if (!beneficio.rows[0]) {
      return res.status(404).json({ error: 'Beneficio no disponible' });
    }

    if (client.rows[0].puntos_vigentes < beneficio.rows[0].puntos_necesarios) {
      return res.status(400).json({ error: 'Puntos insuficientes' });
    }

    const puntosDescontados = -beneficio.rows[0].puntos_necesarios;

    await pool.query(
      `INSERT INTO loyalty_movimientos (client_id, tipo, puntos, beneficio_id, creado_por)
       VALUES ($1, 'canje', $2, $3, NULL)`,
      [client_id, puntosDescontados, beneficio_id]
    );

    await pool.query(
      'UPDATE loyalty_clients SET puntos_vigentes = puntos_vigentes + $1 WHERE id=$2',
      [puntosDescontados, client_id]
    );

    const updated = await pool.query(
      'SELECT id, nombre, puntos_vigentes, nivel FROM loyalty_clients WHERE id=$1',
      [client_id]
    );

    res.json({ cliente: updated.rows[0], beneficio: beneficio.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
