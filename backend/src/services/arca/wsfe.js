// Cliente SOAP para WSFEv1 (Factura Electrónica de ARCA)
const { getEndpoints, getCuit } = require('./config');
const { getTicket } = require('./wsaa');
const { ArcaError, toXml, toArray, postSoap } = require('./soap');

const NS = 'http://ar.gov.afip.dif.FEV1/';

function formatMsgs(list) {
  return toArray(list).map((e) => `[${e.Code}] ${e.Msg}`).join(' | ');
}

// Lanza ArcaError (rechazo explícito, no incierto) si el resultado trae <Errors>
function checkErrors(result, { ignorar = [] } = {}) {
  const errs = toArray(result?.Errors?.Err).filter((e) => !ignorar.includes(String(e.Code)));
  if (errs.length) {
    throw new ArcaError(`ARCA: ${formatMsgs(errs)}`, { code: String(errs[0].Code) });
  }
}

async function call(method, params = {}, { auth = true } = {}) {
  const payload = {};
  if (auth) {
    const cuit = getCuit();
    if (!cuit) throw new ArcaError('ARCA_CUIT no configurado o inválido');
    const { token, sign } = await getTicket('wsfe');
    payload.Auth = { Token: token, Sign: sign, Cuit: cuit };
  }
  Object.assign(payload, params);

  const envelope = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${NS}">`
    + `<soap:Body><ar:${method}>${toXml(payload, 'ar')}</ar:${method}></soap:Body></soap:Envelope>`;

  const body = await postSoap(getEndpoints().wsfe, envelope, `${NS}${method}`);
  const result = body?.[`${method}Response`]?.[`${method}Result`];
  if (!result) throw new ArcaError(`ARCA: respuesta vacía de ${method}`, { incierto: true });
  return result;
}

// Estado de los servidores de ARCA: { AppServer, DbServer, AuthServer }
async function feDummy() {
  const r = await call('FEDummy', {}, { auth: false });
  return { AppServer: r.AppServer, DbServer: r.DbServer, AuthServer: r.AuthServer };
}

// Último número autorizado para el punto de venta y tipo de comprobante
async function feCompUltimoAutorizado(ptoVta, cbteTipo) {
  const r = await call('FECompUltimoAutorizado', { PtoVta: ptoVta, CbteTipo: cbteTipo });
  checkErrors(r);
  const n = Number(r.CbteNro);
  if (!Number.isInteger(n) || n < 0) throw new ArcaError('ARCA: número de último comprobante inválido');
  return n;
}

// Consulta un comprobante emitido. Devuelve null si no existe (error 602).
async function feCompConsultar(ptoVta, cbteTipo, cbteNro) {
  const r = await call('FECompConsultar', {
    FeCompConsReq: { CbteTipo: cbteTipo, CbteNro: cbteNro, PtoVta: ptoVta },
  });
  const errs = toArray(r?.Errors?.Err);
  if (errs.some((e) => String(e.Code) === '602')) return null;
  checkErrors(r);
  return r.ResultGet || null;
}

/**
 * Solicita CAE para un comprobante (FeCAEReq ya armado: { FeCabReq, FeDetReq }).
 * Devuelve { resultado, cae, caeVto, observaciones, errores, mensaje }.
 * No lanza ante un rechazo: el caller decide qué hacer. Sí lanza ArcaError ante errores de red.
 */
async function feCAESolicitar(feCAEReq) {
  const r = await call('FECAESolicitar', { FeCAEReq: feCAEReq });
  const det = toArray(r?.FeDetResp?.FECAEDetResponse)[0] || {};
  const obs = toArray(det?.Observaciones?.Obs);
  const errs = toArray(r?.Errors?.Err);
  const resultado = det.Resultado || r?.FeCabResp?.Resultado || null;
  const partes = [];
  if (errs.length) partes.push(formatMsgs(errs));
  if (obs.length) partes.push(formatMsgs(obs));
  return {
    resultado,
    cae: det.CAE || null,
    caeVto: det.CAEFchVto || null,
    cbteFch: det.CbteFch || null,
    observaciones: obs,
    errores: errs,
    mensaje: partes.join(' | ') || null,
  };
}

module.exports = { feDummy, feCompUltimoAutorizado, feCompConsultar, feCAESolicitar };
