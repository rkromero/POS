import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import ComprobanteChoice from '../ComprobanteChoice'

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

/**
 * Modal de cobro del POS.
 * Paso 1: datos del cliente (teléfono / nombre / email o "Invitado").
 * Paso 2 (sólo venta directa): elección Factura C (ARCA) vs Ticket mostrador.
 * Con `enviaACaja` el paso 2 no existe: el comprobante lo elige el cajero al cobrar.
 *
 * @param {{
 *   enviaACaja: boolean,
 *   total: number,
 *   metodoPagoLabel: string,
 *   busy: false|'fiscal'|'mostrador'|'caja',
 *   onSubmit: (cliente: {nombre: string, email: string|null, whatsapp: string|null}, tipo?: string, doc?: object) => void,
 *   onCancel: () => void,
 * }} props
 */
export default function ClienteModal({ enviaACaja, total, metodoPagoLabel, busy, onSubmit, onCancel }) {
  const [step, setStep] = useState('cliente')
  const [cliente, setCliente] = useState(null)
  const [form, setForm] = useState({ nombre: '', email: '', whatsapp: '' })
  const [matchedClient, setMatchedClient] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  // Buscar cliente por teléfono mientras se carga el pedido (debounce)
  useEffect(() => {
    const phone = form.whatsapp.trim()
    if (phone.length < 5) { setMatchedClient(null); setLookupLoading(false); return }
    let cancelled = false
    setLookupLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/loyalty/search', { params: { q: phone } })
        if (cancelled) return
        const c = res.data
        // Sólo es un match si coincide el teléfono (no por nombre via fallback del backend)
        const isPhoneMatch = c && c.whatsapp && String(c.whatsapp).trim() === phone
        setMatchedClient(isPhoneMatch ? c : null)
      } catch {
        if (!cancelled) setMatchedClient(null)
      } finally {
        if (!cancelled) setLookupLoading(false)
      }
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [form.whatsapp])

  // El nombre sólo es obligatorio si el teléfono no existe en la base o el cliente no tiene nombre
  const clienteNombreRegistrado = matchedClient?.nombre?.trim() || ''
  const nombreObligatorio = !clienteNombreRegistrado

  const next = (c) => {
    if (enviaACaja) return onSubmit(c)
    setCliente(c)
    setStep('comprobante')
  }

  const handleGuardar = () => {
    // El nombre tipeado tiene prioridad; si no, usamos el que ya está registrado para ese teléfono
    const nombre = form.nombre.trim() || clienteNombreRegistrado
    if (!nombre) return toast.error('El nombre del cliente es requerido')
    next({
      nombre,
      email: form.email.trim() || matchedClient?.email || null,
      whatsapp: form.whatsapp.trim() || null,
    })
  }

  const handleInvitado = () => next({ nombre: 'Invitado', email: null, whatsapp: null })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 sm:p-6">
        {step === 'comprobante' ? (
          <>
            <h2 className="text-xl font-bold text-[#111111] mb-1">Comprobante</h2>
            <div className="bg-mimi-50 rounded-xl px-3 py-2 mb-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111111] truncate">{cliente?.nombre}</p>
                <p className="text-xs text-[#444444]">{metodoPagoLabel}</p>
              </div>
              <p className="text-2xl font-bold text-mimi-500 whitespace-nowrap">{fmt(total)}</p>
            </div>
            <ComprobanteChoice busy={busy} onChoose={(tipo, doc) => onSubmit(cliente, tipo, doc)} />
            {!busy && (
              <button onClick={() => setStep('cliente')} className="w-full mt-2 h-11 rounded-xl text-sm text-[#444444] hover:text-[#111111] active:bg-gray-100">
                ← Volver
              </button>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-[#111111] mb-1">Datos del cliente</h2>
            <p className="text-sm text-[#444444] mb-4">Ingresá el teléfono del cliente o continuá como invitado.</p>
            <div className="space-y-3">
              <div>
                <input
                  className="input-field h-12 text-base"
                  placeholder="Teléfono / WhatsApp"
                  inputMode="tel"
                  value={form.whatsapp}
                  onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                  autoFocus
                />
                {lookupLoading && (
                  <p className="text-sm text-[#444444] mt-1 ml-1">Buscando cliente…</p>
                )}
                {!lookupLoading && matchedClient && clienteNombreRegistrado && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <p className="text-base font-semibold text-green-700">✓ {clienteNombreRegistrado}</p>
                    <p className="text-sm text-green-600">
                      {matchedClient.nivel ? `${matchedClient.nivel} · ` : ''}{matchedClient.puntos_vigentes ?? 0} pts · No hace falta cargar el nombre
                    </p>
                  </div>
                )}
                {!lookupLoading && matchedClient && !clienteNombreRegistrado && (
                  <p className="text-sm text-orange-600 mt-1 ml-1">Cliente sin nombre registrado — ingresá el nombre.</p>
                )}
              </div>
              <input
                className="input-field h-12 text-base"
                placeholder={nombreObligatorio ? 'Nombre *' : 'Nombre (opcional)'}
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              />
              <input
                className="input-field h-12 text-base"
                placeholder="Email (opcional)"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleInvitado} disabled={!!busy} className="flex-1 h-14 rounded-xl border border-[#E5E7EB] text-base font-semibold text-[#444444] hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50">
                Invitado
              </button>
              <button onClick={handleGuardar} disabled={!!busy} className="flex-1 h-14 rounded-xl bg-mimi-500 text-white text-base font-semibold hover:bg-mimi-600 active:bg-mimi-700 disabled:opacity-50">
                {enviaACaja ? 'Guardar' : 'Continuar'}
              </button>
            </div>
            <button onClick={onCancel} disabled={!!busy} className="w-full mt-2 h-11 rounded-xl text-sm text-[#444444] hover:text-[#111111] active:bg-gray-100">
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
