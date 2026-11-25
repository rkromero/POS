import { useState } from 'react'
import { docFields, docHint, TIPO_FISCAL, TIPO_MOSTRADOR } from '../utils/factura'

/**
 * Elección del comprobante al cobrar: Factura C (ARCA) o ticket de mostrador.
 * Dos botones grandes (tablet) + DNI/CUIT opcional para la factura.
 *
 * @param {{
 *   onChoose: (tipo: 'fiscal'|'mostrador', doc: {doc_tipo?: number, doc_nro?: string}) => void,
 *   busy?: false|'fiscal'|'mostrador',
 * }} props
 */
export default function ComprobanteChoice({ onChoose, busy = false }) {
  const [showDoc, setShowDoc] = useState(false)
  const [doc, setDoc] = useState('')

  if (busy) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-6" role="status" aria-live="polite">
        <div className="w-10 h-10 border-4 border-mimi-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-lg font-semibold text-[#111111]">
          {busy === TIPO_FISCAL ? 'Facturando en ARCA…' : 'Registrando venta…'}
        </p>
        {busy === TIPO_FISCAL && <p className="text-sm text-[#444444]">Puede tardar unos segundos</p>}
      </div>
    )
  }

  const choose = (tipo) => onChoose(tipo, tipo === TIPO_FISCAL ? docFields(doc) : {})
  const hint = docHint(doc)

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-[#444444] uppercase tracking-wide">¿Qué comprobante emitís?</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => choose(TIPO_FISCAL)}
          className="min-h-[5.5rem] px-2 py-3 rounded-2xl bg-mimi-500 text-white font-bold text-base leading-tight flex flex-col items-center justify-center gap-1 hover:bg-mimi-600 active:bg-mimi-700 active:scale-[0.98] transition-all"
        >
          <span className="text-2xl" aria-hidden="true">🧾</span>
          <span>Factura C</span>
          <span className="text-xs font-medium text-white/85">ticket fiscal ARCA</span>
        </button>
        <button
          type="button"
          onClick={() => choose(TIPO_MOSTRADOR)}
          className="min-h-[5.5rem] px-2 py-3 rounded-2xl border-2 border-mimi-500 text-mimi-500 bg-white font-bold text-base leading-tight flex flex-col items-center justify-center gap-1 hover:bg-mimi-50 active:bg-mimi-100 active:scale-[0.98] transition-all"
        >
          <span className="text-2xl" aria-hidden="true">🎫</span>
          <span>Ticket mostrador</span>
          <span className="text-xs font-medium text-[#444444]">sin factura</span>
        </button>
      </div>

      {showDoc ? (
        <div>
          <label className="block text-sm font-semibold text-[#111111] mb-1">DNI/CUIT del cliente (para la factura)</label>
          <input
            className="input-field h-12 text-base"
            inputMode="numeric"
            autoFocus
            placeholder="Opcional — sólo números"
            value={doc}
            onChange={ev => setDoc(ev.target.value.replace(/[^\d-]/g, '').slice(0, 13))}
          />
          {hint && <p className="text-xs text-[#444444] mt-1 ml-1">{hint}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowDoc(true)}
          className="w-full h-11 rounded-xl text-sm font-medium text-mimi-500 active:bg-mimi-50 hover:underline"
        >
          + Agregar DNI/CUIT del cliente
        </button>
      )}
    </div>
  )
}
