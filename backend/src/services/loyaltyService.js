const pool = require('../db/pool');

// Recalcula y vence puntos expirados de un cliente (lazy expiry)
async function expireClientPoints(clientId) {
  const expired = await pool.query(
    `SELECT id, puntos FROM loyalty_movimientos
     WHERE client_id=$1 AND tipo='acumulacion'
       AND vencido=FALSE AND fecha_vencimiento < CURRENT_DATE`,
    [clientId]
  );
  if (expired.rows.length === 0) return 0;
  let totalExpired = 0;
  for (const m of expired.rows) {
    await pool.query(
      `INSERT INTO loyalty_movimientos (client_id, tipo, puntos, notas)
       VALUES ($1, 'vencimiento', $2, 'Puntos vencidos automáticamente')`,
      [clientId, -m.puntos]
    );
    await pool.query('UPDATE loyalty_movimientos SET vencido=TRUE WHERE id=$1', [m.id]);
    totalExpired += m.puntos;
  }
  if (totalExpired > 0) {
    await pool.query(
      'UPDATE loyalty_clients SET puntos_vigentes = GREATEST(0, puntos_vigentes - $1) WHERE id=$2',
      [totalExpired, clientId]
    );
  }
  return totalExpired;
}

// Recalcula el nivel del cliente según puntos historicos
async function updateClientLevel(clientId) {
  const c = await pool.query('SELECT puntos_total_historico FROM loyalty_clients WHERE id=$1', [clientId]);
  if (!c.rows[0]) return;
  const nivel = await pool.query(
    `SELECT nombre FROM loyalty_levels
     WHERE puntos_minimos <= $1 ORDER BY puntos_minimos DESC LIMIT 1`,
    [c.rows[0].puntos_total_historico]
  );
  if (nivel.rows[0]) {
    await pool.query('UPDATE loyalty_clients SET nivel=$1 WHERE id=$2', [nivel.rows[0].nombre, clientId]);
  }
}

// Otorga puntos al crear una venta
async function awardPoints(sale) {
  if (!sale.cliente_whatsapp && !sale.cliente_email) return;
  try {
    const cfgRes = await pool.query('SELECT * FROM loyalty_config WHERE id=1');
    if (!cfgRes.rows[0] || !cfgRes.rows[0].activo) return;
    const cfg = cfgRes.rows[0];

    // Buscar o crear cliente
    let clientRow = null;
    if (sale.cliente_whatsapp) {
      const r = await pool.query('SELECT * FROM loyalty_clients WHERE whatsapp=$1', [sale.cliente_whatsapp]);
      clientRow = r.rows[0];
    }
    if (!clientRow && sale.cliente_email) {
      const r = await pool.query('SELECT * FROM loyalty_clients WHERE email=$1', [sale.cliente_email]);
      clientRow = r.rows[0];
    }
    if (!clientRow) {
      const r = await pool.query(
        `INSERT INTO loyalty_clients (nombre, whatsapp, email)
         VALUES ($1, $2, $3) RETURNING *`,
        [sale.cliente_nombre || 'Cliente', sale.cliente_whatsapp || null, sale.cliente_email || null]
      );
      clientRow = r.rows[0];
    } else {
      // Actualizar datos si cambió algo
      if ((sale.cliente_whatsapp && !clientRow.whatsapp) || (sale.cliente_email && !clientRow.email)) {
        await pool.query(
          `UPDATE loyalty_clients SET
            whatsapp = COALESCE(whatsapp, $1),
            email = COALESCE(email, $2)
           WHERE id=$3`,
          [sale.cliente_whatsapp || null, sale.cliente_email || null, clientRow.id]
        );
      }
    }

    const puntos = Math.floor(parseFloat(sale.total) / parseFloat(cfg.monto_base)) * cfg.puntos_por_monto;
    if (puntos <= 0) return;

    const fechaVenc = new Date();
    fechaVenc.setMonth(fechaVenc.getMonth() + cfg.vencimiento_meses);

    await pool.query(
      `INSERT INTO loyalty_movimientos (client_id, tipo, puntos, sale_id, fecha_vencimiento)
       VALUES ($1, 'acumulacion', $2, $3, $4)`,
      [clientRow.id, puntos, sale.id, fechaVenc.toISOString().split('T')[0]]
    );

    await pool.query(
      `UPDATE loyalty_clients
       SET puntos_vigentes = puntos_vigentes + $1,
           puntos_total_historico = puntos_total_historico + $1
       WHERE id=$2`,
      [puntos, clientRow.id]
    );

    await updateClientLevel(clientRow.id);
  } catch (err) {
    console.error('[Loyalty] Error al otorgar puntos:', err.message);
  }
}

// Revoca puntos al anular una venta
async function revokePoints(saleId) {
  try {
    const movs = await pool.query(
      `SELECT * FROM loyalty_movimientos WHERE sale_id=$1 AND tipo='acumulacion' AND vencido=FALSE`,
      [saleId]
    );
    for (const m of movs.rows) {
      await pool.query(
        `INSERT INTO loyalty_movimientos (client_id, tipo, puntos, sale_id, notas)
         VALUES ($1, 'anulacion', $2, $3, 'Anulación de venta')`,
        [m.client_id, -m.puntos, saleId]
      );
      await pool.query(
        'UPDATE loyalty_clients SET puntos_vigentes = GREATEST(0, puntos_vigentes - $1) WHERE id=$2',
        [m.puntos, m.client_id]
      );
      await pool.query('UPDATE loyalty_movimientos SET vencido=TRUE WHERE id=$1', [m.id]);
    }
  } catch (err) {
    console.error('[Loyalty] Error al revocar puntos:', err.message);
  }
}

module.exports = { awardPoints, revokePoints, expireClientPoints, updateClientLevel };
