// Flujo de emitirFactura con pool y wsfe simulados (sin red ni base de datos)
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const src = (p) => path.join(__dirname, '..', 'src', p);

// ── Estado simulado ──
let sale;
let wsfeCalls;
let wsfeImpl;

function fakeQuery(sql, params = []) {
  const s = sql.replace(/\s+/g, ' ').trim();
  if (/^(SET|RESET|SELECT pg_advisory)/.test(s)) return { rows: [] };
  if (s.startsWith('SELECT s.*, l.arca_punto_venta')) return { rows: [{ ...sale }] };
  if (s.startsWith('SELECT subtotal FROM sale_items')) return { rows: [{ subtotal: '1000.00' }, { subtotal: '500.50' }] };
  if (s.startsWith('SELECT 1 FROM sales WHERE cbte_tipo')) return { rows: [] };
  if (s.startsWith("UPDATE sales SET tipo_ticket='fiscal'")) { sale.tipo_ticket = 'fiscal'; return { rows: [] }; }
  if (s.startsWith("UPDATE sales SET factura_estado='pendiente'")) {
    Object.assign(sale, { factura_estado: 'pendiente', cbte_tipo: params[1], punto_venta: params[2], cbte_nro: params[3] });
    return { rows: [] };
  }
  if (s.startsWith("UPDATE sales SET factura_estado='autorizada'")) {
    Object.assign(sale, { factura_estado: 'autorizada', factura_error: null, cae: params[1], cae_vto: params[2], factura_fecha: params[3], imp_neto: params[4], cbte_nro: params[7] });
    return { rows: [] };
  }
  if (s.startsWith("UPDATE sales SET factura_estado='error'")) {
    if (sale.factura_estado !== 'autorizada') {
      sale.factura_estado = 'error';
      sale.factura_error = params[1];
      if (!params[2]) sale.cbte_nro = null;
    }
    return { rows: [] };
  }
  if (s.startsWith('SELECT s.*, l.nombre as local_nombre')) return { rows: [{ ...sale }] };
  if (s.startsWith('SELECT si.*')) return { rows: [] };
  if (s.startsWith('SELECT * FROM arca_config')) return { rows: [{ razon_social: 'Mimí', condicion_iva: 'Responsable Monotributo' }] };
  throw new Error(`SQL no simulado: ${s}`);
}

const fakePool = {
  query: async (sql, params) => fakeQuery(sql, params),
  connect: async () => ({ query: async (sql, params) => fakeQuery(sql, params), release() {} }),
};
const fakeWsfe = new Proxy({}, {
  get: (_, method) => async (...args) => { wsfeCalls.push([method, ...args]); return wsfeImpl[method](...args); },
});

require.cache[src('db/pool.js')] = { id: src('db/pool.js'), filename: src('db/pool.js'), loaded: true, exports: fakePool };
require.cache[src('services/arca/wsfe.js')] = { id: 'wsfe', filename: src('services/arca/wsfe.js'), loaded: true, exports: fakeWsfe };

process.env.ARCA_CUIT = '20123456786';
process.env.ARCA_CERT = '-----BEGIN CERTIFICATE-----\\nX\\n-----END CERTIFICATE-----';
process.env.ARCA_KEY = '-----BEGIN PRIVATE KEY-----\\nX\\n-----END PRIVATE KEY-----';

const { emitirFactura } = require(src('services/arca/facturaService.js'));
const { ArcaError } = require(src('services/arca/soap.js'));

beforeEach(() => {
  sale = { id: 7, local_id: 1, total: '1500.50', arca_punto_venta: 3, factura_estado: null, cbte_nro: null, doc_tipo: 99, doc_nro: 0 };
  wsfeCalls = [];
  wsfeImpl = {
    feCompUltimoAutorizado: async () => 41,
    feCAESolicitar: async () => ({ resultado: 'A', cae: '76123456789012', caeVto: '20261205', cbteFch: '20261125', mensaje: null }),
    feCompConsultar: async () => null,
  };
});

test('autoriza con número = último + 1 y devuelve QR', async () => {
  const r = await emitirFactura(7);
  assert.equal(r.factura_estado, 'autorizada');
  assert.equal(r.cbte_nro, 42);
  assert.equal(r.cae, '76123456789012');
  assert.equal(r.cae_vto, '2026-12-05');
  assert.ok(r.qr_url.startsWith('https://www.afip.gob.ar/fe/qr/?p='));
  assert.equal(r.emisor.cuit, '20123456786');
  const req = wsfeCalls.find((c) => c[0] === 'feCAESolicitar')[1];
  assert.equal(req.FeCabReq.CbteTipo, 11);
  assert.equal(req.FeDetReq.FECAEDetRequest.CbteDesde, 42);
  assert.equal(req.FeDetReq.FECAEDetRequest.ImpTotal, '1500.50');
});

test('es idempotente si ya está autorizada', async () => {
  sale.factura_estado = 'autorizada';
  sale.cae = '1';
  await emitirFactura(7);
  assert.equal(wsfeCalls.length, 0);
});

test('rechazo explícito: estado error con mensaje y sin número', async () => {
  wsfeImpl.feCAESolicitar = async () => ({ resultado: 'R', cae: null, mensaje: '[10016] Número inválido' });
  const r = await emitirFactura(7);
  assert.equal(r.factura_estado, 'error');
  assert.match(r.factura_error, /10016/);
  assert.equal(r.cbte_nro, null);
});

test('timeout: conserva el número y al reintentar adopta el CAE existente', async () => {
  wsfeImpl.feCAESolicitar = async () => { throw new ArcaError('Tiempo de espera agotado', { incierto: true }); };
  let r = await emitirFactura(7);
  assert.equal(r.factura_estado, 'error');
  assert.equal(r.cbte_nro, 42);
  assert.match(r.factura_error, /incierto/);

  wsfeCalls = [];
  wsfeImpl.feCompConsultar = async () => ({ CodAutorizacion: '76000000000001', ImpTotal: '1500.5', DocTipo: '99', DocNro: '0', FchVto: '20261205', CbteFch: '20261125' });
  r = await emitirFactura(7);
  assert.equal(r.factura_estado, 'autorizada');
  assert.equal(r.cae, '76000000000001');
  assert.equal(r.cbte_nro, 42);
  assert.ok(!wsfeCalls.some((c) => c[0] === 'feCAESolicitar'));
});

test('sin punto de venta en el local: error claro sin llamar a ARCA', async () => {
  sale.arca_punto_venta = null;
  const r = await emitirFactura(7);
  assert.equal(r.factura_estado, 'error');
  assert.match(r.factura_error, /punto de venta/);
  assert.equal(wsfeCalls.length, 0);
});

test('ARCA autoriza pero falla el guardado: conserva el número y el reintento la recupera sin emitir otra', async () => {
  let fallarGuardado = true;
  const orig = fakePool.connect;
  fakePool.connect = async () => ({
    query: async (sql, params) => {
      if (fallarGuardado && /UPDATE sales SET factura_estado='autorizada'/.test(sql)) {
        throw new Error('duplicate key value violates unique constraint "idx_sales_comprobante_unico"');
      }
      return fakeQuery(sql, params);
    },
    release() {},
  });
  try {
    let r = await emitirFactura(7);
    assert.equal(r.factura_estado, 'error');
    assert.equal(r.cbte_nro, 42);
    assert.match(r.factura_error, /autorizó el comprobante 42/);

    fallarGuardado = false;
    wsfeCalls = [];
    wsfeImpl.feCompConsultar = async () => ({ CodAutorizacion: '76123456789012', ImpTotal: '1500.5', DocTipo: '99', DocNro: '0', FchVto: '20261205', CbteFch: '20261125' });
    r = await emitirFactura(7);
    assert.equal(r.factura_estado, 'autorizada');
    assert.equal(r.cbte_nro, 42);
    assert.ok(!wsfeCalls.some((c) => c[0] === 'feCAESolicitar'), 'no debe emitir una segunda factura');
  } finally {
    fakePool.connect = orig;
  }
});
