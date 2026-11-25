const fmt = (v) => `$${parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

/**
 * Renglón de un producto en el carrito del POS.
 * @param {{ item: object, total: number, onEditWeight: () => void, onQty: (delta: number) => void, onRemove: () => void }} props
 */
export default function CartItemRow({ item, total, onEditWeight, onQty, onRemove }) {
  return (
    <div className="border border-[#E5E7EB] rounded-xl p-2">
      <div className="flex items-start justify-between gap-2 px-1">
        <p className="text-sm font-semibold text-[#111111] leading-tight line-clamp-2">{item.nombre}</p>
        <p className="text-sm font-bold text-[#111111] whitespace-nowrap">{fmt(total)}</p>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        {item.es_peso
          ? <p className="flex-1 min-w-0 pl-1 text-xs text-orange-500 font-medium">{item.gramos}g · {fmt(item.precio_unitario)}/kg</p>
          : <p className="flex-1 min-w-0 pl-1 text-xs text-mimi-500 font-medium">{fmt(item.precio_unitario)} c/u</p>
        }
        {item.es_peso ? (
          <button
            onClick={onEditWeight}
            className="h-11 px-3 rounded-xl bg-orange-50 text-orange-600 text-sm font-semibold active:bg-orange-100 flex-shrink-0"
          >
            ✎ Editar
          </button>
        ) : (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onQty(-1)}
              aria-label="Restar uno"
              className="w-11 h-11 rounded-xl bg-mimi-50 text-mimi-500 font-bold text-xl flex items-center justify-center active:bg-mimi-100"
            >
              −
            </button>
            <span className="w-9 text-center text-base font-bold">{item.cantidad}</span>
            <button
              onClick={() => onQty(1)}
              aria-label="Sumar uno"
              className="w-11 h-11 rounded-xl bg-mimi-50 text-mimi-500 font-bold text-xl flex items-center justify-center active:bg-mimi-100"
            >
              +
            </button>
          </div>
        )}
        <button
          onClick={onRemove}
          aria-label="Quitar producto"
          className="w-11 h-11 rounded-xl text-red-400 active:bg-red-50 active:text-red-600 flex items-center justify-center flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
