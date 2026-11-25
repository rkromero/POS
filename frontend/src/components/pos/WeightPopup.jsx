import { useState } from 'react'

const fmt = (v) => `$${parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

/**
 * Popup para cargar los gramos de un producto vendido por peso.
 * @param {{ product: object, initialGramos?: string, onAdd: (gramos: string) => void, onCancel: () => void }} props
 */
export default function WeightPopup({ product, initialGramos = '', onAdd, onCancel }) {
  const [gramosInput, setGramosInput] = useState(initialGramos)
  const add = () => onAdd(gramosInput)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 sm:p-6">
        <h2 className="text-xl font-bold text-[#111111] mb-0.5">{product.nombre}</h2>
        <p className="text-sm text-[#444444] mb-5">Precio: {fmt(product.precio)} por kilo</p>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-[#111111] mb-1">Gramos</label>
          <input
            className="input-field h-16 text-3xl font-bold text-center"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            autoFocus
            placeholder="350"
            value={gramosInput}
            onChange={e => setGramosInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
        </div>
        {gramosInput > 0 && (
          <div className="bg-mimi-50 rounded-xl p-3 mb-4 text-center">
            <p className="text-xs text-[#444444] mb-0.5">Precio a cobrar</p>
            <p className="text-2xl font-bold text-mimi-500">
              {fmt(parseFloat(product.precio) * parseInt(gramosInput) / 1000)}
            </p>
            <p className="text-xs text-[#444444] mt-0.5">{gramosInput}g</p>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={add}
            disabled={!gramosInput || parseInt(gramosInput) <= 0}
            className="btn-primary flex-1 h-14 text-base active:bg-mimi-700"
          >
            Agregar al carrito
          </button>
          <button onClick={onCancel} className="btn-secondary flex-1 h-14 text-base active:bg-mimi-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
