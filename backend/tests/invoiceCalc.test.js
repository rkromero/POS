const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularFactura, buildQrUrl, normalizarReceptor, cuitValido, formatFechaISO, CBTE_TIPO_FACTURA_C,
} = require('../src/services/arca/invoiceCalc');

test('Factura C: neto = total, IVA y exento en 0, sin alícuotas', () => {
  const r = calcularFactura([{ subtotal: '1500.00' }, { subtotal: 250.5 }]);
  assert.deepEqual(r, { imp_total: 1750.5, imp_neto: 1750.5, imp_iva: 0, imp_op_ex: 0, alicuotas: [] });
});

test('redondea a 2 decimales sin errores de punto flotante', () => {
  // 0.1 + 0.2 en float = 0.30000000000000004
  const r = calcularFactura([{ subtotal: 0.1 }, { subtotal: 0.2 }]);
  assert.equal(r.imp_total, 0.3);
  assert.equal(r.imp_neto, 0.3);
  // productos por kg: subtotales con muchos decimales
  const k = calcularFactura([{ subtotal: 1234.5678 }, { subtotal: 99.999 }]);
  assert.equal(k.imp_total, 1334.57);
  assert.equal(k.imp_neto, k.imp_total);
});

test('usa el total cobrado si difiere sólo por redondeo de ítems', () => {
  const r = calcularFactura([{ subtotal: '10.01' }, { subtotal: '10.01' }], { total: '20.03' });
  assert.equal(r.imp_total, 20.03);
  assert.equal(r.imp_neto, 20.03);
});

test('rechaza totales que no coinciden con los ítems', () => {
  assert.throws(() => calcularFactura([{ subtotal: 100 }], { total: 150 }), /no coincide/);
});

test('rechaza factura vacía o en cero', () => {
  assert.throws(() => calcularFactura([]), /al menos un ítem/);
  assert.throws(() => calcularFactura([{ subtotal: 0 }]), /mayor a cero/);
  assert.throws(() => calcularFactura([{ subtotal: 'abc' }]), /Subtotal inválido/);
});

test('buildQrUrl genera el JSON de ARCA con números como números', () => {
  const url = buildQrUrl({
    fecha: '2026-11-25', cuit: '20123456786', ptoVta: 3, tipoCmp: 11, nroCmp: 42,
    importe: 1750.5, tipoDocRec: 99, nroDocRec: 0, codAut: '76123456789012',
  });
  assert.ok(url.startsWith('https://www.afip.gob.ar/fe/qr/?p='));
  const json = JSON.parse(Buffer.from(url.split('?p=')[1], 'base64').toString('utf8'));
  assert.deepEqual(json, {
    ver: 1, fecha: '2026-11-25', cuit: 20123456786, ptoVta: 3, tipoCmp: 11, nroCmp: 42,
    importe: 1750.5, moneda: 'PES', ctz: 1, tipoDocRec: 99, nroDocRec: 0,
    tipoCodAut: 'E', codAut: 76123456789012,
  });
});

test('buildQrUrl usa Factura C por defecto y acepta fecha YYYYMMDD o Date', () => {
  const decode = (u) => JSON.parse(Buffer.from(u.split('?p=')[1], 'base64').toString('utf8'));
  const a = decode(buildQrUrl({ fecha: '20261125', cuit: 1, ptoVta: 1, nroCmp: 1, importe: 1, tipoDocRec: 99, codAut: 1 }));
  assert.equal(a.fecha, '2026-11-25');
  assert.equal(a.tipoCmp, CBTE_TIPO_FACTURA_C);
  assert.equal(formatFechaISO(new Date(2026, 0, 5)), '2026-01-05');
});

test('normalizarReceptor: consumidor final, DNI y CUIT', () => {
  assert.deepEqual(normalizarReceptor({}), { doc_tipo: 99, doc_nro: 0 });
  assert.deepEqual(normalizarReceptor({ doc_tipo: 99, doc_nro: 123 }), { doc_tipo: 99, doc_nro: 0 });
  assert.deepEqual(normalizarReceptor({ doc_tipo: '96', doc_nro: '30.123.456' }), { doc_tipo: 96, doc_nro: 30123456 });
  assert.deepEqual(normalizarReceptor({ doc_tipo: 80, doc_nro: '20-12345678-6' }), { doc_tipo: 80, doc_nro: 20123456786 });
  assert.throws(() => normalizarReceptor({ doc_tipo: 96, doc_nro: '123' }), /DNI inválido/);
  assert.throws(() => normalizarReceptor({ doc_tipo: 80, doc_nro: '20123456780' }), /CUIT inválido/);
  assert.throws(() => normalizarReceptor({ doc_tipo: 1, doc_nro: '1' }), /Tipo de documento/);
});

test('cuitValido verifica el dígito verificador', () => {
  assert.equal(cuitValido('20123456786'), true);
  assert.equal(cuitValido('30500010912'), true);
  assert.equal(cuitValido('20123456787'), false);
  assert.equal(cuitValido('123'), false);
});
