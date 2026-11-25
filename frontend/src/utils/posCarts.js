/** Carritos múltiples del POS: creación, nombres y persistencia en localStorage. */

export const STORAGE_KEY = 'pos_carts'

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `c${Date.now()}${Math.floor(Math.random() * 1e6)}`

export const makeCart = (nombre) => ({ id: newId(), nombre, items: [], metodoPago: 'efectivo' })

// Devuelve el primer nombre "Cliente N" libre, rellenando huecos
export const nextClienteName = (existing) => {
  const names = new Set(existing.map(c => c.nombre))
  let n = 1
  while (names.has(`Cliente ${n}`)) n++
  return `Cliente ${n}`
}

export const loadInitial = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && Array.isArray(saved.carts) && saved.carts.length) {
      const carts = saved.carts.map(c => ({
        id: c.id || newId(),
        nombre: c.nombre || 'Cliente',
        items: Array.isArray(c.items) ? c.items : [],
        metodoPago: c.metodoPago || 'efectivo',
      }))
      const activeCartId = carts.find(c => c.id === saved.activeCartId)?.id || carts[0].id
      return { carts, activeCartId }
    }
  } catch { /* noop */ }
  const first = makeCart('Cliente 1')
  return { carts: [first], activeCartId: first.id }
}
