// Tests sin red ni base de datos: firma del TRA, armado de la solicitud y parseo de PEM.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const forge = require('node-forge');

const { readPem } = require('../src/services/arca/config');
const { buildTra, signTra } = require('../src/services/arca/wsaa');
const { toXml } = require('../src/services/arca/soap');
const { armarSolicitud, hoyArgentina, CBTE_TIPO } = require('../src/services/arca/facturaService');

function certAutofirmado() {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 86400000);
  const attrs = [{ name: 'commonName', value: 'test' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert, key: keys.privateKey };
}

test('readPem acepta PEM literal, con \\n escapados y en base64', () => {
  const pem = '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----';
  assert.equal(readPem(pem), pem);
  assert.equal(readPem(pem.replace(/\n/g, '\\n')), pem);
  assert.equal(readPem(Buffer.from(pem).toString('base64')), pem);
  assert.equal(readPem(''), null);
  assert.equal(readPem('no-es-un-pem'), null);
});

test('buildTra arma un loginTicketRequest para wsfe con ventana de ±10 min', () => {
  const now = new Date('2026-11-25T12:00:00Z');
  const tra = buildTra('wsfe', now);
  assert.match(tra, /<service>wsfe<\/service>/);
  assert.match(tra, /<generationTime>2026-11-25T11:50:00.000Z<\/generationTime>/);
  assert.match(tra, /<expirationTime>2026-11-25T12:10:00.000Z<\/expirationTime>/);
});

test('signTra produce un CMS SignedData con el TRA adjunto y el certificado', () => {
  const creds = certAutofirmado();
  const tra = buildTra('wsfe');
  const b64 = signTra(tra, creds);
  const msg = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.decode64(b64)));
  assert.equal(msg.type, forge.pki.oids.signedData);
  assert.equal(msg.certificates.length, 1);
  assert.equal(Buffer.from(msg.rawCapture.content.value[0].value, 'binary').toString('utf8'), tra);
});

test('armarSolicitud: Factura C sin bloque Iva y campos en el orden del WSDL', () => {
  const req = armarSolicitud({
    pv: 3, nro: 43, fecha: '20261125',
    calc: { imp_total: 1750.5, imp_neto: 1750.5, imp_iva: 0, imp_op_ex: 0 },
    docTipo: 99, docNro: 0,
  });
  assert.equal(CBTE_TIPO, 11);
  assert.deepEqual(req.FeCabReq, { CantReg: 1, PtoVta: 3, CbteTipo: 11 });
  const det = req.FeDetReq.FECAEDetRequest;
  assert.equal(det.Iva, undefined);
  assert.equal(det.ImpTotal, '1750.50');
  assert.equal(det.ImpNeto, '1750.50');
  assert.equal(det.ImpIVA, '0.00');
  assert.equal(det.CondicionIVAReceptorId, 5);
  assert.deepEqual(Object.keys(det), [
    'Concepto', 'DocTipo', 'DocNro', 'CbteDesde', 'CbteHasta', 'CbteFch', 'ImpTotal', 'ImpTotConc',
    'ImpNeto', 'ImpOpEx', 'ImpTrib', 'ImpIVA', 'MonId', 'MonCotiz', 'CondicionIVAReceptorId',
  ]);
  const xml = toXml({ FeCAEReq: req }, 'ar');
  assert.match(xml, /^<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1<\/ar:CantReg>/);
  assert.match(xml, /<ar:CbteTipo>11<\/ar:CbteTipo>/);
});

test('toXml escapa caracteres especiales y repite arrays', () => {
  assert.equal(toXml({ A: 'x<&>' }), '<A>x&lt;&amp;&gt;</A>');
  assert.equal(toXml({ L: [{ Id: 1 }, { Id: 2 }] }, 'ar'), '<ar:L><ar:Id>1</ar:Id></ar:L><ar:L><ar:Id>2</ar:Id></ar:L>');
});

test('errorTaVigente: mensaje claro con hora límite en Argentina', () => {
  const { errorTaVigente } = require('../src/services/arca/wsaa');
  // 12:50 UTC + 12 h = 00:50 UTC = 21:50 en Argentina
  const e = errorTaVigente(new Date('2026-11-25T12:50:00Z'));
  assert.equal(e.incierto, false);
  assert.match(e.message, /ARCA ya emitió un ticket de acceso vigente que no está guardado; reintentar después de las 21:50/);
});

test('hoyArgentina usa la zona horaria de Buenos Aires', () => {
  // 02:00 UTC del 26/11 = 23:00 del 25/11 en Argentina (UTC-3)
  assert.deepEqual(hoyArgentina(new Date('2026-11-26T02:00:00Z')), { iso: '2026-11-25', afip: '20261125' });
});
