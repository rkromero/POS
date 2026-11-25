// Transporte SOAP mínimo para los web services de ARCA.
// Usa el módulo https nativo (y no fetch) para poder, si hace falta, relajar el nivel
// de seguridad TLS con ARCA_TLS_LEGACY=1: algunos servidores de ARCA usan claves DH
// cortas que OpenSSL 3 rechaza ("dh key too small").
const https = require('https');
const { XMLParser } = require('fast-xml-parser');

const TIMEOUT_MS = 20000;

// incierto=true: no sabemos si ARCA procesó el pedido (timeout, red, error de servidor)
class ArcaError extends Error {
  constructor(message, { code = null, incierto = false } = {}) {
    super(message);
    this.name = 'ArcaError';
    this.code = code;
    this.incierto = incierto;
  }
}

const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false, ignoreAttributes: true });

function parseXml(xml) {
  return parser.parse(xml);
}

function escapeXml(v) {
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Convierte un objeto JS en XML: arrays => elementos repetidos con el nombre de la clave
function toXml(obj, prefix = '') {
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const tag = prefix ? `${prefix}:${k}` : k;
    const values = Array.isArray(v) ? v : [v];
    for (const item of values) {
      const inner = typeof item === 'object' ? toXml(item, prefix) : escapeXml(item);
      out += `<${tag}>${inner}</${tag}>`;
    }
  }
  return out;
}

function toArray(v) {
  if (v === undefined || v === null || v === '') return [];
  return Array.isArray(v) ? v : [v];
}

let legacyAgent = null;
function getAgent() {
  if (process.env.ARCA_TLS_LEGACY !== '1') return undefined;
  if (!legacyAgent) legacyAgent = new https.Agent({ keepAlive: false, ciphers: 'DEFAULT@SECLEVEL=1' });
  return legacyAgent;
}

function httpPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      agent: getAgent(),
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error(`Tiempo de espera agotado (${TIMEOUT_MS / 1000}s)`)));
    req.on('error', reject);
    req.end(body);
  });
}

/**
 * Envía un sobre SOAP y devuelve el contenido de <Body> parseado.
 * Lanza ArcaError (incierto=true) ante errores de red o respuestas no parseables.
 * Si la respuesta es un SOAP Fault, lanza ArcaError con incierto=faultIncierto.
 */
async function postSoap(url, envelope, soapAction, { faultIncierto = true } = {}) {
  let res;
  try {
    res = await httpPost(url, envelope, {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"${soapAction}"`,
    });
  } catch (err) {
    throw new ArcaError(`No se pudo comunicar con ARCA: ${err.message}`, { incierto: true });
  }

  let parsed;
  try {
    parsed = parseXml(res.text);
  } catch {
    throw new ArcaError(`Respuesta inválida de ARCA (HTTP ${res.status})`, { incierto: true });
  }
  const body = parsed?.Envelope?.Body;
  if (!body) {
    throw new ArcaError(`Respuesta inesperada de ARCA (HTTP ${res.status})`, { incierto: true });
  }
  if (body.Fault) {
    const f = body.Fault;
    const msg = f.faultstring || f.Reason?.Text || 'Error SOAP';
    throw new ArcaError(`ARCA: ${msg}`, { code: f.faultcode || null, incierto: faultIncierto });
  }
  return body;
}

module.exports = { ArcaError, parseXml, escapeXml, toXml, toArray, postSoap };
