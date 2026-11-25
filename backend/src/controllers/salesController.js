const pool = require('../db/pool');
const { awardPoints } = require('../services/loyaltyService');
const {
  createSaleTx, getFullSale, localTieneCajero, parseFiscalInput,
} = require('../services/salesService');
const { emitirFactura, emitirFacturaSegura } = require('../services/arca/facturaService');

async function getAll(req, res, next) {
  try {
    const { page = 1, limit = 20, desde, hasta, local_id } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    const effectiveLocalId = req.user.role === 'admin' ? local_id : req.user.local_id;
    if (effectiveLocalId) { params.push(effectiveLocalId); conditions.push(`s.local_id = $${params.length}`); }
    if (desde) { params.push(desde); conditions.push(`s.created_at >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conditions.push(`s.created_at < ($${params.length}::date + interval '1 day')`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const filterParams = [...params];
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT s.*, l.nombre as local_nombre, u.nombre as user_nombre
       FROM sales s JOIN locals l ON l.id=s.local_id JOIN users u ON u.id=s.user_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await pool.query(`SELECT COUNT(*) FROM sales s ${where}`, filterParams);
    res.json({ data: result.rows, total: parseInt(count.rows[0].count), page: parseInt(page) });
  } catch (err) { next(err); }
}

// Valida el id y el acceso del usuario a la venta. Devuelve el id o responde 400/403/404.
async function checkSaleAccess(req, res) {
  const saleId = Number(req.params.id);
  if (!Number.isInteger(saleId) || saleId <= 0) {
    res.status(400).json({ error: 'Venta inválida' });
    return null;
  }
  const r = await pool.query('SELECT local_id FROM sales WHERE id=$1', [saleId]);
  if (!r.rows[0]) {
    res.status(404).json({ error: 'Venta no encontrada' });
    return null;
  }
  if (req.user.role !== 'admin' && r.rows[0].local_id !== req.user.local_id) {
    res.status(403).json({ error: 'No autorizado' });
    return null;
  }
  return saleId;
}

async function getById(req, res, next) {
  try {
    const saleId = await checkSaleAccess(req, res);
    if (!saleId) return;
    res.json(await getFullSale(saleId));
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  const client = await pool.connect();
  let released = false;
  try {
    const { cliente_nombre, cliente_email, cliente_whatsapp, metodo_pago, items } = req.body;
    const local_id = req.user.role === 'admin' ? req.body.local_id : req.user.local_id;
    const fiscal = parseFiscalInput(req.body);

    // Si el local tiene cajero, el usuario del local no cobra: envía el pedido a caja
    if (req.user.role === 'local' && await localTieneCajero(local_id)) {
      return res.status(403).json({ error: 'Este local tiene cajero: enviá el pedido a caja para cobrarlo' });
    }

    await client.query('BEGIN');
    const saleId = await createSaleTx(client, {
      local_id, user_id: req.user.id, metodo_pago, items, cliente_nombre, cliente_email, cliente_whatsapp,
      ...fiscal,
    });
    await client.query('COMMIT');
    // Liberar la conexión antes de llamar a ARCA (puede demorar varios segundos)
    client.release();
    released = true;

    // La venta ya está confirmada: si la factura falla queda registrada en la venta y se reintenta luego
    if (fiscal.tipo_ticket === 'fiscal') await emitirFacturaSegura(saleId);

    const saleData = await getFullSale(saleId);

    // Otorgar puntos de fidelización (no bloquea la respuesta)
    awardPoints(saleData);

    res.status(201).json(saleData);
  } catch (err) {
    if (!released) await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    if (!released) client.release();
  }
}

// POST /api/sales/:id/facturar — emite o reintenta la factura de una venta existente
async function facturar(req, res, next) {
  try {
    const saleId = await checkSaleAccess(req, res);
    if (!saleId) return;

    // Permite informar/corregir el documento del receptor mientras no esté autorizada ni
    // tenga un número en estado incierto (cambiarlo impediría recuperar ese comprobante)
    if (req.body && req.body.doc_tipo !== undefined) {
      const { doc_tipo, doc_nro } = parseFiscalInput({ ...req.body, tipo_ticket: 'fiscal' });
      await pool.query(
        `UPDATE sales SET doc_tipo=$2, doc_nro=$3
         WHERE id=$1 AND factura_estado IS DISTINCT FROM 'autorizada' AND cbte_nro IS NULL`,
        [saleId, doc_tipo, doc_nro]
      );
    }

    res.json(await emitirFactura(saleId));
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, facturar };
