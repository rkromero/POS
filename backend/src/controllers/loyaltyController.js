const pool = require('../db/pool');
const { expireClientPoints, updateClientLevel } = require('../services/loyaltyService');

// ── Config ─────────────────────────────────────────────────────
async function getConfig(req, res, next) {
  try {
    const r = await pool.query('SELECT * FROM loyalty_config WHERE id=1');
    res.json(r.rows[0]);
  } catch (err) { next(err); }
}

async function updateConfig(req, res, next) {
  try {
    const { puntos_por_monto, monto_base, vencimiento_meses, activo } = req.body;
    const r = await pool.query(
      `UPDATE loyalty_config SET
        puntos_por_monto = COALESCE($1, puntos_por_monto),
        monto_base       = COALESCE($2, monto_base),
        vencimiento_meses = COALESCE($3, vencimiento_meses),
        activo           = COALESCE($4, activo),
        updated_at       = NOW()
       WHERE id=1 RETURNING *`,
      [puntos_por_monto || null, monto_base || null, vencimiento_meses || null, activo ?? null]
    );
    res.json(r.rows[0]);
  } catch (err) { next(err); }
}

// ── Niveles ────────────────────────────────────────────────────
async function getLevels(req, res, next) {
  try {
    const r = await pool.query('SELECT * FROM loyalty_levels ORDER BY puntos_minimos ASC');
    res.json(r.rows);
  } catch (err) { next(err); }
}

async function updateLevels(req, res, next) {
  try {
    const { levels } = req.body; // [{id, nombre, puntos_minimos}]
    for (const l of levels) {
      await pool.query(
        'UPDATE loyalty_levels SET nombre=$1, puntos_minimos=$2 WHERE id=$3',
        [l.nombre, l.puntos_minimos, l.id]
      );
    }
    const r = await pool.query('SELECT * FROM loyalty_levels ORDER BY puntos_minimos ASC');
    res.json(r.rows);
  } catch (err) { next(err); }
}

// ── Beneficios ─────────────────────────────────────────────────
async function getBeneficios(req, res, next) {
  try {
    const soloActivos = req.user.role !== 'admin';
    const r = await pool.query(
      `SELECT * FROM loyalty_beneficios ${soloActivos ? 'WHERE activo=TRUE' : ''} ORDER BY puntos_necesarios ASC`
    );
    res.json(r.rows);
  } catch (err) { next(err); }
}

async function createBeneficio(req, res, next) {
  try {
    const { nombre, tipo, puntos_necesarios, descripcion } = req.body;
    const r = await pool.query(
      'INSERT INTO loyalty_beneficios (nombre, tipo, puntos_necesarios, descripcion) VALUES ($1,$2,$3,$4) RETURNING *',
      [nombre, tipo, puntos_necesarios, descripcion || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { next(err); }
}

async function updateBeneficio(req, res, next) {
  try {
    const { nombre, tipo, puntos_necesarios, descripcion, activo } = req.body;
    const r = await pool.query(
      `UPDATE loyalty_beneficios SET
        nombre=$1, tipo=$2, puntos_necesarios=$3, descripcion=$4, activo=$5
       WHERE id=$6 RETURNING *`,
      [nombre, tipo, puntos_necesarios, descripcion || null, activo, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (err) { next(err); }
}

async function deleteBeneficio(req, res, next) {
  try {
    await pool.query('UPDATE loyalty_beneficios SET activo=FALSE WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── Clientes ───────────────────────────────────────────────────
async function getClientes(req, res, next) {
  try {
    const { search, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conds = [];
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(lc.nombre ILIKE $${params.length} OR lc.whatsapp ILIKE $${params.length} OR lc.email ILIKE $${params.length})`);
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    params.push(limit, offset);
    const r = await pool.query(
      `SELECT lc.*,
        (SELECT MAX(s.created_at) FROM sales s
         WHERE (s.cliente_whatsapp = lc.whatsapp AND lc.whatsapp IS NOT NULL)
            OR (s.cliente_email = lc.email AND lc.email IS NOT NULL)) as ultima_compra
       FROM loyalty_clients lc ${where}
       ORDER BY lc.puntos_vigentes DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const countParams = search ? [`%${search}%`] : [];
    const total = await pool.query(`SELECT COUNT(*) FROM loyalty_clients lc ${where}`, countParams);
    res.json({ data: r.rows, total: parseInt(total.rows[0].count) });
  } catch (err) { next(err); }
}

async function getClienteDetail(req, res, next) {
  try {
    const { id } = req.params;
    await expireClientPoints(parseInt(id));
    const client = await pool.query('SELECT * FROM loyalty_clients WHERE id=$1', [id]);
    if (!client.rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    const movimientos = await pool.query(
      `SELECT lm.*, lb.nombre as beneficio_nombre, u.nombre as creado_por_nombre
       FROM loyalty_movimientos lm
       LEFT JOIN loyalty_beneficios lb ON lb.id = lm.beneficio_id
       LEFT JOIN users u ON u.id = lm.creado_por
       WHERE lm.client_id=$1
       ORDER BY lm.created_at DESC LIMIT 50`,
      [id]
    );
    res.json({ ...client.rows[0], movimientos: movimientos.rows });
  } catch (err) { next(err); }
}

async function ajustarPuntos(req, res, next) {
  try {
    const { id } = req.params;
    const { puntos, notas } = req.body;
    const delta = parseInt(puntos);
    if (!delta || delta === 0) return res.status(400).json({ error: 'puntos inválidos' });

    const client = await pool.query('SELECT * FROM loyalty_clients WHERE id=$1', [id]);
    if (!client.rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });

    if (delta < 0 && client.rows[0].puntos_vigentes + delta < 0) {
      return res.status(400).json({ error: 'El cliente no tiene suficientes puntos' });
    }

    await pool.query(
      `INSERT INTO loyalty_movimientos (client_id, tipo, puntos, notas, creado_por)
       VALUES ($1, 'ajuste_manual', $2, $3, $4)`,
      [id, delta, notas || 'Ajuste manual por administrador', req.user.id]
    );

    await pool.query(
      `UPDATE loyalty_clients SET
        puntos_vigentes = GREATEST(0, puntos_vigentes + $1),
        puntos_total_historico = CASE WHEN $1 > 0 THEN puntos_total_historico + $1 ELSE puntos_total_historico END
       WHERE id=$2`,
      [delta, id]
    );

    await updateClientLevel(parseInt(id));
    const updated = await pool.query('SELECT * FROM loyalty_clients WHERE id=$1', [id]);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
}

// ── Canje ──────────────────────────────────────────────────────
async function canjear(req, res, next) {
  try {
    const { client_id, beneficio_id } = req.body;
    await expireClientPoints(parseInt(client_id));

    const client = await pool.query('SELECT * FROM loyalty_clients WHERE id=$1', [client_id]);
    if (!client.rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });

    const beneficio = await pool.query('SELECT * FROM loyalty_beneficios WHERE id=$1 AND activo=TRUE', [beneficio_id]);
    if (!beneficio.rows[0]) return res.status(404).json({ error: 'Beneficio no disponible' });

    if (client.rows[0].puntos_vigentes < beneficio.rows[0].puntos_necesarios) {
      return res.status(400).json({ error: 'Puntos insuficientes' });
    }

    const puntosDescontados = -beneficio.rows[0].puntos_necesarios;
    await pool.query(
      `INSERT INTO loyalty_movimientos (client_id, tipo, puntos, beneficio_id, creado_por)
       VALUES ($1, 'canje', $2, $3, $4)`,
      [client_id, puntosDescontados, beneficio_id, req.user.id]
    );

    await pool.query(
      'UPDATE loyalty_clients SET puntos_vigentes = puntos_vigentes + $1 WHERE id=$2',
      [puntosDescontados, client_id]
    );

    const updated = await pool.query('SELECT * FROM loyalty_clients WHERE id=$1', [client_id]);
    res.json({ cliente: updated.rows[0], beneficio: beneficio.rows[0] });
  } catch (err) { next(err); }
}

// ── Búsqueda rápida (POS) ──────────────────────────────────────
async function searchCliente(req, res, next) {
  try {
    const { q } = req.query;
    if (!q) return res.json(null);
    await expireClientPoints; // Skip for search perf

    let r = await pool.query(
      'SELECT * FROM loyalty_clients WHERE whatsapp=$1 OR email=$1',
      [q]
    );
    if (!r.rows[0]) {
      r = await pool.query(
        `SELECT * FROM loyalty_clients WHERE nombre ILIKE $1 LIMIT 1`,
        [`%${q}%`]
      );
    }
    res.json(r.rows[0] || null);
  } catch (err) { next(err); }
}

// ── Dashboard ──────────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    const [totalClientes, totalPuntos, top5, movHoy, movMes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM loyalty_clients'),
      pool.query('SELECT COALESCE(SUM(puntos_vigentes),0) as total FROM loyalty_clients'),
      pool.query('SELECT id, nombre, whatsapp, puntos_vigentes, nivel FROM loyalty_clients ORDER BY puntos_vigentes DESC LIMIT 5'),
      pool.query(`SELECT COALESCE(SUM(puntos),0) as puntos FROM loyalty_movimientos WHERE tipo='acumulacion' AND created_at >= CURRENT_DATE`),
      pool.query(`SELECT COALESCE(SUM(puntos),0) as puntos FROM loyalty_movimientos WHERE tipo='acumulacion' AND created_at >= date_trunc('month', CURRENT_DATE)`),
    ]);

    const sinCompras30 = await pool.query(
      `SELECT COUNT(*) FROM loyalty_clients lc
       WHERE NOT EXISTS (
         SELECT 1 FROM sales s
         WHERE (s.cliente_whatsapp = lc.whatsapp AND lc.whatsapp IS NOT NULL)
            OR (s.cliente_email = lc.email AND lc.email IS NOT NULL)
         AND s.created_at >= NOW() - interval '30 days'
       )`
    );

    const movimientos7dias = await pool.query(
      `SELECT DATE(created_at) as fecha, SUM(CASE WHEN puntos>0 THEN puntos ELSE 0 END) as otorgados
       FROM loyalty_movimientos
       WHERE created_at >= NOW() - interval '7 days'
       GROUP BY DATE(created_at)
       ORDER BY fecha ASC`
    );

    res.json({
      total_clientes: parseInt(totalClientes.rows[0].count),
      total_puntos_vigentes: parseInt(totalPuntos.rows[0].total),
      puntos_hoy: parseInt(movHoy.rows[0].puntos),
      puntos_mes: parseInt(movMes.rows[0].puntos),
      top_clientes: top5.rows,
      sin_compras_30_dias: parseInt(sinCompras30.rows[0].count),
      movimientos_7dias: movimientos7dias.rows,
    });
  } catch (err) { next(err); }
}

// ── Movimientos (admin) ────────────────────────────────────────
async function getMovimientos(req, res, next) {
  try {
    const { page = 1, limit = 30, client_id } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conds = [];
    if (client_id) { params.push(client_id); conds.push(`lm.client_id = $${params.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    params.push(limit, offset);

    const r = await pool.query(
      `SELECT lm.*, lc.nombre as cliente_nombre, lb.nombre as beneficio_nombre, u.nombre as creado_por_nombre
       FROM loyalty_movimientos lm
       JOIN loyalty_clients lc ON lc.id = lm.client_id
       LEFT JOIN loyalty_beneficios lb ON lb.id = lm.beneficio_id
       LEFT JOIN users u ON u.id = lm.creado_por
       ${where}
       ORDER BY lm.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const cntParams = client_id ? [client_id] : [];
    const total = await pool.query(`SELECT COUNT(*) FROM loyalty_movimientos lm ${where}`, cntParams);
    res.json({ data: r.rows, total: parseInt(total.rows[0].count) });
  } catch (err) { next(err); }
}

module.exports = {
  getConfig, updateConfig,
  getLevels, updateLevels,
  getBeneficios, createBeneficio, updateBeneficio, deleteBeneficio,
  getClientes, getClienteDetail, ajustarPuntos,
  canjear, searchCliente,
  getDashboard, getMovimientos,
};
