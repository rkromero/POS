// Configuración de ARCA (ex-AFIP) leída de variables de entorno.
// Nunca loguear el certificado, la clave privada, el token ni el sign.
const forge = require('node-forge');

const ENDPOINTS = {
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
};

function getEnv() {
  return process.env.ARCA_ENV === 'produccion' ? 'produccion' : 'homologacion';
}

function getEndpoints() {
  return ENDPOINTS[getEnv()];
}

// CUIT del emisor como string de 11 dígitos (o null si falta / es inválido)
function getCuit() {
  const raw = String(process.env.ARCA_CUIT || '').replace(/\D/g, '');
  return raw.length === 11 ? raw : null;
}

// Acepta PEM literal (con saltos reales o "\n" escapados) o el PEM codificado en base64
function readPem(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/^["']|["']$/g, '');
  if (!s.includes('-----BEGIN')) {
    try {
      const decoded = Buffer.from(s, 'base64').toString('utf8');
      if (!decoded.includes('-----BEGIN')) return null;
      s = decoded.trim();
    } catch {
      return null;
    }
  }
  return s.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}

function getCertPem() { return readPem(process.env.ARCA_CERT); }
function getKeyPem() { return readPem(process.env.ARCA_KEY); }

function isConfigured() {
  return Boolean(getCuit() && getCertPem() && getKeyPem());
}

// Carga cert y clave como objetos forge. Lanza un error legible si no se pueden leer.
function loadCredentials() {
  const certPem = getCertPem();
  const keyPem = getKeyPem();
  if (!certPem || !keyPem) throw new Error('Faltan ARCA_CERT o ARCA_KEY');
  let cert;
  let key;
  try { cert = forge.pki.certificateFromPem(certPem); } catch {
    throw new Error('No se pudo leer el certificado ARCA_CERT (PEM inválido)');
  }
  try { key = forge.pki.privateKeyFromPem(keyPem); } catch {
    throw new Error('No se pudo leer la clave privada ARCA_KEY (PEM inválido o encriptado)');
  }
  return { cert, key };
}

// Fecha de vencimiento del certificado (ISO) o null
function getCertVencimiento() {
  const certPem = getCertPem();
  if (!certPem) return null;
  try {
    return forge.pki.certificateFromPem(certPem).validity.notAfter.toISOString();
  } catch {
    return null;
  }
}

module.exports = {
  getEnv, getEndpoints, getCuit, readPem, isConfigured, loadCredentials, getCertVencimiento,
};
