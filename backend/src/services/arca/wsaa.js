// WSAA: autenticación con ARCA. Obtiene el Ticket de Acceso (token + sign) y lo cachea en
// la tabla arca_ta, porque WSAA rechaza un nuevo login mientras exista un TA válido
// ("El CEE ya posee un TA valido") y Railway puede reiniciar el proceso en cualquier momento.
const forge = require('node-forge');
const pool = require('../../db/pool');
const { getEnv, getEndpoints, loadCredentials } = require('./config');
const { ArcaError, parseXml, postSoap } = require('./soap');

const MARGEN_MS = 5 * 60 * 1000; // se renueva 5 minutos antes del vencimiento
const LOCK_NS_WSAA = 7301; // espacio de advisory locks para el login

function buildTra(service, now = new Date()) {
  const gen = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const exp = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const uniqueId = Math.floor(now.getTime() / 1000);
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<loginTicketRequest version="1.0">'
    + `<header><uniqueId>${uniqueId}</uniqueId><generationTime>${gen}</generationTime>`
    + `<expirationTime>${exp}</expirationTime></header>`
    + `<service>${service}</service>`
    + '</loginTicketRequest>';
}

// Firma el TRA como CMS/PKCS#7 SignedData (SHA-256, contenido adjunto) y lo devuelve en base64
function signTra(tra, { cert, key }) {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

async function loginCms(service) {
  const cms = signTra(buildTra(service), loadCredentials());
  const envelope = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"'
    + ' xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">'
    + '<soapenv:Header/><soapenv:Body><wsaa:loginCms>'
    + `<wsaa:in0>${cms}</wsaa:in0>`
    + '</wsaa:loginCms></soapenv:Body></soapenv:Envelope>';

  // Un Fault de WSAA es un rechazo explícito (cert inválido, TA vigente, etc.)
  const body = await postSoap(getEndpoints().wsaa, envelope, '', { faultIncierto: false });
  const ret = body?.loginCmsResponse?.loginCmsReturn;
  if (!ret) throw new ArcaError('WSAA: respuesta sin loginCmsReturn');

  const ticket = parseXml(ret)?.loginTicketResponse;
  const token = ticket?.credentials?.token;
  const sign = ticket?.credentials?.sign;
  const expiresAt = new Date(ticket?.header?.expirationTime);
  if (!token || !sign || Number.isNaN(expiresAt.getTime())) {
    throw new ArcaError('WSAA: ticket de acceso incompleto');
  }
  return { token, sign, expiresAt };
}

// "El CEE ya posee un TA valido": hay un TA emitido (p. ej. por un login manual o un proceso
// que murió antes de guardarlo) que no tenemos. No hay forma de recuperarlo: hay que esperar.
// Un TA de WSAA dura como máximo 12 horas, así que esa hora es una cota superior.
function errorTaVigente(now = new Date()) {
  const hora = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(now.getTime() + 12 * 60 * 60 * 1000));
  return new ArcaError(
    'ARCA ya emitió un ticket de acceso vigente que no está guardado; '
    + `reintentar después de las ${hora} (como máximo) o esperar su vencimiento`,
    { code: 'TA_VIGENTE' }
  );
}

async function leerCache(db, env, service) {
  const r = await db.query(
    `SELECT token, sign, expires_at FROM arca_ta
     WHERE env=$1 AND service=$2 AND expires_at > $3`,
    [env, service, new Date(Date.now() + MARGEN_MS)]
  );
  return r.rows[0] ? { token: r.rows[0].token, sign: r.rows[0].sign, expiresAt: r.rows[0].expires_at } : null;
}

/**
 * Devuelve { token, sign } válidos para el servicio (por defecto 'wsfe').
 * Usa el TA cacheado si está vigente; si no, hace login serializado con un advisory lock.
 */
async function getTicket(service = 'wsfe') {
  const env = getEnv();
  const cached = await leerCache(pool, env, service);
  if (cached) return cached;

  const client = await pool.connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', [LOCK_NS_WSAA, env === 'produccion' ? 2 : 1]);
    locked = true;
    // Otro proceso pudo haber renovado el TA mientras esperábamos el lock
    const again = await leerCache(client, env, service);
    if (again) return again;

    let ta;
    try {
      ta = await loginCms(service);
    } catch (err) {
      if (/TA v[aá]lido/i.test(err.message)) throw errorTaVigente();
      throw err;
    }
    await client.query(
      `INSERT INTO arca_ta (env, service, token, sign, expires_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (env, service) DO UPDATE
         SET token=EXCLUDED.token, sign=EXCLUDED.sign, expires_at=EXCLUDED.expires_at, updated_at=NOW()`,
      [env, service, ta.token, ta.sign, ta.expiresAt]
    );
    return ta;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_NS_WSAA, env === 'produccion' ? 2 : 1]).catch(() => {});
    client.release();
  }
}

module.exports = { buildTra, signTra, loginCms, getTicket, errorTaVigente };
