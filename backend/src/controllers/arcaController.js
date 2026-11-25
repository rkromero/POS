const pool = require('../db/pool');
const arcaConfig = require('../services/arca/config');
const { formatFechaISO } = require('../services/arca/invoiceCalc');
const { CBTE_TIPO } = require('../services/arca/facturaService');
const wsfe = require('../services/arca/wsfe');

const CAMPOS_TEXTO = { razon_social: 150, domicilio_comercial: 200, iibb: 30 };

function formatConfig(row) {
  if (!row) return null;
  return { ...row, inicio_actividades: row.inicio_actividades ? formatFechaISO(row.inicio_actividades) : null };
}

// GET /api/arca/config
async function getConfig(req, res, next) {
  try {
    const r = await pool.query('SELECT * FROM arca_config WHERE id=1');
    res.json(formatConfig(r.rows[0]));
  } catch (err) { next(err); }
}

// PUT /api/arca/config — solo admin. Campo ausente = no se modifica; '' o null = se borra.
async function updateConfig(req, res, next) {
  try {
    const sets = [];
    const params = [];
    const body = req.body || {};

    for (const [campo, max] of Object.entries(CAMPOS_TEXTO)) {
      if (body[campo] === undefined) continue;
      if (body[campo] !== null && typeof body[campo] !== 'string') {
        return res.status(400).json({ error: `${campo} debe ser texto` });
      }
      const v = body[campo] === null ? '' : body[campo].trim();
      if (v.length > max) return res.status(400).json({ error: `${campo} admite hasta ${max} caracteres` });
      params.push(v || null);
      sets.push(`${campo} = $${params.length}`);
    }

    if (body.inicio_actividades !== undefined) {
      const v = body.inicio_actividades;
      let fecha = null;
      if (v !== null && v !== '') {
        const ok = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
          && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime())
          && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
        if (!ok) return res.status(400).json({ error: 'inicio_actividades debe tener formato YYYY-MM-DD' });
        fecha = v;
      }
      params.push(fecha);
      sets.push(`inicio_actividades = $${params.length}::date`);
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No hay datos para actualizar' });

    const r = await pool.query(
      `UPDATE arca_config SET ${sets.join(', ')}, updated_at = NOW() WHERE id=1 RETURNING *`,
      params
    );
    res.json(formatConfig(r.rows[0]));
  } catch (err) { next(err); }
}

// GET /api/arca/status — solo admin. Nunca devuelve 500 por errores de ARCA.
async function getStatus(req, res, next) {
  try {
    const status = {
      env: arcaConfig.getEnv(),
      cuit: arcaConfig.getCuit(),
      configurado: arcaConfig.isConfigured(),
      cert_vencimiento: arcaConfig.getCertVencimiento(),
      cbte_tipo: CBTE_TIPO,
      dummy: null,
      puntos_venta: [],
    };

    try {
      status.dummy = await wsfe.feDummy();
    } catch (err) {
      status.dummy = { error: err.message };
    }

    const locales = await pool.query(
      `SELECT id, nombre, arca_punto_venta FROM locals
       WHERE arca_punto_venta IS NOT NULL ORDER BY arca_punto_venta, id`
    );
    for (const l of locales.rows) {
      const item = { local_id: l.id, local_nombre: l.nombre, punto_venta: l.arca_punto_venta };
      if (!status.configurado) {
        item.error = 'ARCA no configurado';
      } else {
        try {
          item.ultimo_autorizado = await wsfe.feCompUltimoAutorizado(l.arca_punto_venta, CBTE_TIPO);
        } catch (err) {
          item.error = err.message;
        }
      }
      status.puntos_venta.push(item);
    }

    res.json(status);
  } catch (err) { next(err); }
}

module.exports = { getConfig, updateConfig, getStatus };
