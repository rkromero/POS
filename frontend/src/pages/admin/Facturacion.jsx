import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { formatCuit, formatDateOnly, formatNroFactura } from '../../utils/ticketHtml'

const EMPTY_CONFIG = { razon_social: '', domicilio_comercial: '', iibb: '', inicio_actividades: '' }

// Días hasta una fecha (negativo si ya venció)
const diasHasta = (fecha) => {
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((d.getTime() - Date.now()) / 86400000)
}

function Badge({ ok, children, warn = false }) {
  const cls = ok ? 'bg-green-100 text-green-700' : warn ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
  return <span className={`text-xs px-2 py-1 rounded-full font-semibold ${cls}`}>{children}</span>
}

export default function Facturacion() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl sm:text-2xl font-bold text-[#111111]">Facturación ARCA</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <EmisorForm />
        <EstadoPanel />
      </div>
    </div>
  )
}

// ── Datos del emisor ───────────────────────────────────────────────────────
function EmisorForm() {
  const [config, setConfig] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/arca/config')
      .then(r => setConfig({
        ...EMPTY_CONFIG,
        ...Object.fromEntries(Object.entries(r.data || {}).map(([k, v]) => [k, v ?? ''])),
        inicio_actividades: r.data?.inicio_actividades ? String(r.data.inicio_actividades).slice(0, 10) : '',
      }))
      .catch(() => { setConfig(EMPTY_CONFIG); toast.error('Error al cargar los datos del emisor') })
  }, [])

  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        razon_social: config.razon_social.trim(),
        domicilio_comercial: config.domicilio_comercial.trim(),
        iibb: config.iibb.trim(),
        inicio_actividades: config.inicio_actividades || null,
      }
      await api.put('/arca/config', payload)
      toast.success('Datos del emisor guardados')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!config) return <div className="card"><p className="text-center py-8 text-[#444444]">Cargando...</p></div>

  return (
    <div className="card">
      <h2 className="text-sm font-bold uppercase tracking-wide mb-1">Datos del emisor</h2>
      <p className="text-xs text-[#444444] mb-4">Se imprimen en el encabezado de la factura.</p>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Razón social *</label>
          <input className="input-field" value={config.razon_social} onChange={e => set('razon_social', e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Domicilio comercial *</label>
          <input className="input-field" value={config.domicilio_comercial} onChange={e => set('domicilio_comercial', e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Ingresos Brutos</label>
            <input className="input-field" value={config.iibb} onChange={e => set('iibb', e.target.value)} placeholder={'Nº o "Exento"'} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Inicio de actividades</label>
            <input type="date" className="input-field" value={config.inicio_actividades} onChange={e => set('inicio_actividades', e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-[#444444] bg-mimi-50 rounded-xl px-3 py-2">
          El CUIT, el certificado y el entorno (homologación/producción) se configuran en el servidor.
        </p>
        <button type="submit" disabled={saving} className="btn-primary w-full min-h-[3rem]">
          {saving ? 'Guardando...' : 'Guardar datos del emisor'}
        </button>
      </form>
    </div>
  )
}

// ── Estado de la conexión con ARCA ─────────────────────────────────────────
function EstadoPanel() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStatus((await api.get('/arca/status')).data)
    } catch (err) {
      setStatus(null)
      toast.error(err.response?.data?.error || 'Error al consultar el estado de ARCA')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const esProd = status && /prod/i.test(String(status.env))
  const dias = status?.cert_vencimiento ? diasHasta(status.cert_vencimiento) : null
  const dummy = status?.dummy || {}

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wide">Estado de la conexión</h2>
        <button onClick={load} disabled={loading} className="btn-secondary text-sm py-1.5 px-4 min-h-[2.75rem]">
          {loading ? 'Consultando…' : '↻ Actualizar'}
        </button>
      </div>

      {!status ? (
        <p className="text-center py-8 text-[#444444]">{loading ? 'Consultando ARCA…' : 'No se pudo obtener el estado'}</p>
      ) : (
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 items-center">
            <dt className="text-[#444444]">Entorno</dt>
            <dd>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${esProd ? 'bg-mimi-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                {esProd ? 'Producción' : 'Homologación (pruebas)'}
              </span>
            </dd>
            <dt className="text-[#444444]">CUIT</dt>
            <dd className="font-mono">{status.cuit ? formatCuit(status.cuit) : '—'}</dd>
            <dt className="text-[#444444]">Configurado</dt>
            <dd><Badge ok={!!status.configurado}>{status.configurado ? 'Sí' : 'No'}</Badge></dd>
            <dt className="text-[#444444]">Certificado</dt>
            <dd>
              {status.cert_vencimiento ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span>Vence {formatDateOnly(status.cert_vencimiento)}</span>
                  {dias !== null && (
                    <Badge ok={dias > 30} warn={dias >= 0 && dias <= 30}>
                      {dias < 0 ? 'Vencido' : `${dias} días`}
                    </Badge>
                  )}
                </span>
              ) : '—'}
            </dd>
          </dl>

          <div>
            <p className="text-xs font-semibold text-[#444444] uppercase tracking-wide mb-2">Servidores ARCA</p>
            {dummy.error ? (
              <p className="text-red-600 bg-red-50 rounded-xl px-3 py-2 break-words">{dummy.error}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {['AppServer', 'DbServer', 'AuthServer'].map(k => (
                  <Badge key={k} ok={String(dummy[k]).toUpperCase() === 'OK'}>{k}: {dummy[k] ?? '—'}</Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-[#444444] uppercase tracking-wide mb-2">Puntos de venta por local</p>
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-mimi-50 text-xs uppercase tracking-wide text-[#444444]">
                    <th className="text-left py-2 px-3">Local</th>
                    <th className="text-right py-2 px-3">P. venta</th>
                    <th className="text-right py-2 px-3">Último cbte.</th>
                  </tr>
                </thead>
                <tbody>
                  {(status.puntos_venta || []).map(pv => (
                    <tr key={pv.local_id} className="border-t border-[#E5E7EB]">
                      <td className="py-2 px-3 font-medium">{pv.local_nombre}</td>
                      <td className="py-2 px-3 text-right font-mono">{pv.punto_venta ?? <span className="text-gray-400">—</span>}</td>
                      <td className="py-2 px-3 text-right">
                        {pv.error
                          ? <span className="text-xs text-red-600 break-words">{pv.error}</span>
                          : pv.ultimo_autorizado !== undefined && pv.ultimo_autorizado !== null && pv.punto_venta
                            ? <span className="font-mono">{formatNroFactura(pv.punto_venta, pv.ultimo_autorizado)}</span>
                            : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                  {(status.puntos_venta || []).length === 0 && (
                    <tr><td colSpan="3" className="text-center py-4 text-[#444444]">Ningún local tiene punto de venta asignado. Configuralo en Locales.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
