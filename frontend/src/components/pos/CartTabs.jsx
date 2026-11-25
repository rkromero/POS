import { useState } from 'react'

const cartCount = (c) => c.items.reduce((s, i) => s + (i.es_peso ? 1 : i.cantidad), 0)

/**
 * Pestañas de los carritos abiertos del POS (con renombrado por doble toque).
 * @param {{ carts: object[], activeCartId: string, onSelect: (id: string) => void,
 *   onRename: (id: string, nombre: string) => void, onRemove: (id: string) => void, onAdd: () => void }} props
 */
export default function CartTabs({ carts, activeCartId, onSelect, onRename, onRemove, onAdd }) {
  const [editingCartId, setEditingCartId] = useState(null)
  const [editingName, setEditingName] = useState('')

  const startRename = (c) => { setEditingCartId(c.id); setEditingName(c.nombre) }
  const commitRename = () => {
    if (editingCartId) {
      const name = editingName.trim()
      if (name) onRename(editingCartId, name)
    }
    setEditingCartId(null)
    setEditingName('')
  }
  const cancelRename = () => { setEditingCartId(null); setEditingName('') }

  // El "+" queda fijo al final, fuera del scroll
  return (
    <div className="flex items-start gap-2 flex-shrink-0">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
        {carts.map(c => {
          const isActive = c.id === activeCartId
          const count = cartCount(c)
          return (
            <div
              key={c.id}
              className={`h-12 flex items-center rounded-xl flex-shrink-0 border transition-colors ${
                isActive ? 'bg-mimi-500 border-mimi-500 text-white' : 'bg-white border-[#E5E7EB] text-[#444444]'
              }`}
            >
              {editingCartId === c.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') cancelRename() }}
                  enterKeyHint="done"
                  className="w-36 h-10 mx-1 text-base text-[#111111] rounded-lg px-2 border border-mimi-100 outline-none"
                />
              ) : (
                <button
                  onClick={() => onSelect(c.id)}
                  onDoubleClick={() => startRename(c)}
                  title="Doble toque para renombrar"
                  className="h-full pl-3 pr-2 text-sm font-semibold whitespace-nowrap max-w-[10rem] truncate"
                >
                  {c.nombre}
                  {count > 0 && <span className={isActive ? 'text-white/80 ml-1' : 'text-mimi-500 ml-1'}>·{count}</span>}
                </button>
              )}
              {isActive && editingCartId !== c.id && (
                <button
                  onClick={() => startRename(c)}
                  aria-label="Renombrar carrito"
                  className="h-full w-9 flex items-center justify-center text-sm active:bg-white/25 rounded-lg"
                >
                  ✎
                </button>
              )}
              {carts.length > 1 && (
                <button
                  onClick={() => onRemove(c.id)}
                  aria-label="Cerrar carrito"
                  className={`h-full w-10 flex items-center justify-center text-sm flex-shrink-0 rounded-r-xl ${
                    isActive ? 'active:bg-white/25' : 'active:bg-gray-100'
                  }`}
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>
      <button
        onClick={onAdd}
        aria-label="Nuevo carrito"
        className="flex-shrink-0 w-12 h-12 rounded-xl border-2 border-dashed border-mimi-100 text-mimi-500 text-2xl font-bold active:bg-mimi-50 flex items-center justify-center"
      >
        +
      </button>
    </div>
  )
}
